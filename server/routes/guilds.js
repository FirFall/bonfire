const express = require("express");
const { rest, insert } = require("../db");
const { requireAuth } = require("../auth");
const { nextId, inviteCode } = require("../snowflake");
const ah = require("../async");

const router = express.Router();
router.use(requireAuth);

// List guilds the current user belongs to (embeds guild via FK)
router.get("/", ah(async (req, res) => {
  const rows = await rest("guild_members", {
    query: {
      user_id: `eq.${req.user.id}`,
      select: "role,guilds(id,name,invite_code,created_at)",
    },
  });
  const guilds = rows
    .filter((r) => r.guilds)
    .map((r) => ({
      id: String(r.guilds.id),
      name: r.guilds.name,
      invite_code: r.guilds.invite_code,
      role: r.role,
    }));
  guilds.sort((a, b) => String(a.id).localeCompare(String(b.id))); // snowflake ids sort by time
  res.json({ guilds });
}));

// Create a guild (creator becomes owner, gets a #general channel).
// PostgREST has no multi-statement transaction, so if a follow-up insert
// fails we delete the guild (cascades clean up its rows) and report.
router.post("/", ah(async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (name.length < 2 || name.length > 100)
    return res.status(400).json({ error: "Server name must be 2-100 characters" });

  const guildId = nextId();
  const code = inviteCode();
  try {
    await insert("guilds", { id: guildId, name, owner_id: req.user.id, invite_code: code });
  } catch (err) {
    console.error("create guild error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
  try {
    await insert("guild_members", { guild_id: guildId, user_id: req.user.id, role: "owner" });
    await insert("channels", { id: nextId(), guild_id: guildId, name: "general", position: 0 });
  } catch (err) {
    console.error("create guild error (rolling back)", err);
    await rest("guilds", { method: "DELETE", query: { id: `eq.${guildId}` } }).catch(() => {});
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(201).json({ guild: { id: guildId, name, invite_code: code, role: "owner" } });
}));

// Join a guild via invite code
router.post("/join", ah(async (req, res) => {
  const code = (req.body?.invite_code || "").trim();
  if (!code) return res.status(400).json({ error: "Invite code required" });

  const rows = await rest("guilds", {
    query: { invite_code: `eq.${code}`, select: "id,name" },
  });
  const guild = rows[0];
  if (!guild) return res.status(404).json({ error: "Invalid invite code" });

  // ignore-duplicates == ON CONFLICT DO NOTHING (PK is guild_id+user_id)
  await rest("guild_members", {
    method: "POST",
    body: { guild_id: guild.id, user_id: req.user.id },
    headers: { Prefer: "resolution=ignore-duplicates" },
  });
  res.json({ guild: { id: String(guild.id), name: guild.name, invite_code: code, role: "member" } });
}));

// Guild detail: channels + members (only for members)
router.get("/:id", ah(async (req, res) => {
  const guildId = req.params.id;

  const membership = await rest("guild_members", {
    query: { guild_id: `eq.${guildId}`, user_id: `eq.${req.user.id}`, select: "role" },
  });
  if (!membership[0]) return res.status(403).json({ error: "Not a member of this server" });

  const guilds = await rest("guilds", {
    query: { id: `eq.${guildId}`, select: "id,name,invite_code" },
  });
  if (!guilds[0]) return res.status(404).json({ error: "Server not found" });

  const [channels, memberRows] = await Promise.all([
    rest("channels", {
      query: { guild_id: `eq.${guildId}`, select: "id,name,position", order: "position.asc,name.asc" },
    }),
    rest("guild_members", {
      query: {
        guild_id: `eq.${guildId}`,
        select: "role,joined_at,users(id,username,avatar_color)",
        order: "joined_at.asc",
      },
    }),
  ]);

  res.json({
    guild: { ...guilds[0], id: String(guilds[0].id), role: membership[0].role },
    channels: channels.map((c) => ({ ...c, id: String(c.id) })),
    members: memberRows
      .filter((m) => m.users)
      .map((m) => ({
        id: String(m.users.id),
        username: m.users.username,
        avatar_color: m.users.avatar_color,
        role: m.role,
        joined_at: m.joined_at,
      })),
  });
}));

// Create a text channel
router.post("/:id/channels", ah(async (req, res) => {
  const guildId = req.params.id;
  const name = (req.body?.name || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9._-]{2,50}$/.test(name))
    return res.status(400).json({ error: "Channel name must be 2-50 chars (a-z, 0-9, . _ -)" });

  const membership = await rest("guild_members", {
    query: { guild_id: `eq.${guildId}`, user_id: `eq.${req.user.id}`, select: "role" },
  });
  if (!membership[0]) return res.status(403).json({ error: "Not a member of this server" });

  const top = await rest("channels", {
    query: { guild_id: `eq.${guildId}`, select: "position", order: "position.desc", limit: "1" },
  });
  const position = (top[0]?.position ?? -1) + 1;
  const id = nextId();
  await insert("channels", { id, guild_id: guildId, name, position });
  res.status(201).json({ channel: { id, name, position } });
}));

module.exports = router;
