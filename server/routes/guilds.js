const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../auth");
const { nextId, inviteCode } = require("../snowflake");

const router = express.Router();
router.use(requireAuth);

// List guilds the current user belongs to
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.invite_code, gm.role
     FROM guilds g
     JOIN guild_members gm ON gm.guild_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at ASC`,
    [req.user.id]
  );
  res.json({ guilds: rows.map((r) => ({ ...r, id: String(r.id) })) });
});

// Create a guild (creator becomes owner, gets a #general channel)
router.post("/", async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (name.length < 2 || name.length > 100)
    return res.status(400).json({ error: "Server name must be 2-100 characters" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const guildId = nextId();
    const code = inviteCode();
    await client.query(
      "INSERT INTO guilds (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)",
      [guildId, name, req.user.id, code]
    );
    await client.query(
      "INSERT INTO guild_members (guild_id, user_id, role) VALUES ($1, $2, 'owner')",
      [guildId, req.user.id]
    );
    await client.query(
      "INSERT INTO channels (id, guild_id, name, position) VALUES ($1, $2, 'general', 0)",
      [nextId(), guildId]
    );
    await client.query("COMMIT");
    res.status(201).json({ guild: { id: guildId, name, invite_code: code, role: "owner" } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("create guild error", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Join a guild via invite code
router.post("/join", async (req, res) => {
  const code = (req.body?.invite_code || "").trim();
  if (!code) return res.status(400).json({ error: "Invite code required" });

  const { rows } = await pool.query("SELECT id, name FROM guilds WHERE invite_code = $1", [code]);
  const guild = rows[0];
  if (!guild) return res.status(404).json({ error: "Invalid invite code" });

  await pool.query(
    `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
     ON CONFLICT (guild_id, user_id) DO NOTHING`,
    [guild.id, req.user.id]
  );
  res.json({ guild: { id: String(guild.id), name: guild.name, invite_code: code, role: "member" } });
});

// Guild detail: channels + members (only for members)
router.get("/:id", async (req, res) => {
  const guildId = req.params.id;

  const membership = await pool.query(
    "SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2",
    [guildId, req.user.id]
  );
  if (!membership.rows[0]) return res.status(403).json({ error: "Not a member of this server" });

  const guild = await pool.query("SELECT id, name, invite_code FROM guilds WHERE id = $1", [guildId]);
  if (!guild.rows[0]) return res.status(404).json({ error: "Server not found" });

  const [channels, members] = await Promise.all([
    pool.query(
      "SELECT id, name, position FROM channels WHERE guild_id = $1 ORDER BY position, name",
      [guildId]
    ),
    pool.query(
      `SELECT u.id, u.username, u.avatar_color, gm.role, gm.joined_at
       FROM guild_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.guild_id = $1
       ORDER BY gm.joined_at ASC`,
      [guildId]
    ),
  ]);

  res.json({
    guild: { ...guild.rows[0], id: String(guild.rows[0].id), role: membership.rows[0].role },
    channels: channels.rows.map((c) => ({ ...c, id: String(c.id) })),
    members: members.rows.map((m) => ({ ...m, id: String(m.id) })),
  });
});

// Create a text channel
router.post("/:id/channels", async (req, res) => {
  const guildId = req.params.id;
  const name = (req.body?.name || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9._-]{2,50}$/.test(name))
    return res.status(400).json({ error: "Channel name must be 2-50 chars (a-z, 0-9, . _ -)" });

  const membership = await pool.query(
    "SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2",
    [guildId, req.user.id]
  );
  if (!membership.rows[0]) return res.status(403).json({ error: "Not a member of this server" });

  const pos = await pool.query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM channels WHERE guild_id = $1",
    [guildId]
  );
  const id = nextId();
  await pool.query(
    "INSERT INTO channels (id, guild_id, name, position) VALUES ($1, $2, $3, $4)",
    [id, guildId, name, pos.rows[0].next]
  );
  res.status(201).json({ channel: { id, name, position: pos.rows[0].next } });
});

module.exports = router;
