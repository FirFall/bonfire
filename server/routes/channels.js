const express = require("express");
const { rest, insert, isChannelMember } = require("../db");
const { requireAuth } = require("../auth");
const { nextId } = require("../snowflake");
const { broadcastToChannel } = require("../ws");

const router = express.Router();
router.use(requireAuth);

// Fetch recent messages (newest 50, returned oldest-first for display).
// Author info comes along via the users FK embed.
router.get("/:id/messages", async (req, res) => {
  const channelId = req.params.id;
  if (!(await isChannelMember(req.user.id, channelId)))
    return res.status(403).json({ error: "Not a member of this channel's server" });

  const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
  const rows = await rest("messages", {
    query: {
      channel_id: `eq.${channelId}`,
      select: "id,channel_id,user_id,content,created_at,users(username,avatar_color)",
      order: "created_at.desc,id.desc",
      limit: String(limit),
    },
  });
  res.json({
    messages: rows.reverse().map((m) => ({
      id: String(m.id),
      channel_id: String(m.channel_id),
      user_id: String(m.user_id),
      content: m.content,
      created_at: m.created_at,
      username: m.users?.username || "unknown",
      avatar_color: m.users?.avatar_color || "#5865f2",
    })),
  });
});

// Send a message - persisted, then broadcast over WebSocket to channel subscribers
router.post("/:id/messages", async (req, res) => {
  const channelId = req.params.id;
  const content = (req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "Message cannot be empty" });
  if (content.length > 2000) return res.status(400).json({ error: "Message too long (2000 chars max)" });

  if (!(await isChannelMember(req.user.id, channelId)))
    return res.status(403).json({ error: "Not a member of this channel's server" });

  const author = await rest("users", {
    query: { id: `eq.${req.user.id}`, select: "username,avatar_color" },
  });
  const row = await insert("messages", {
    id: nextId(),
    channel_id: channelId,
    user_id: req.user.id,
    content,
  });

  const message = {
    id: String(row.id),
    channel_id: channelId,
    user_id: req.user.id,
    content,
    created_at: row.created_at,
    username: author[0]?.username || "unknown",
    avatar_color: author[0]?.avatar_color || "#5865f2",
  };
  broadcastToChannel(channelId, { op: "MESSAGE_CREATE", data: message });
  res.status(201).json({ message });
});

module.exports = router;
