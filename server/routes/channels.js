const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../auth");
const { nextId } = require("../snowflake");
const { broadcastToChannel } = require("../ws");

const router = express.Router();
router.use(requireAuth);

async function memberCheck(channelId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM guild_members gm
     JOIN channels c ON c.guild_id = gm.guild_id
     WHERE c.id = $1 AND gm.user_id = $2`,
    [channelId, userId]
  );
  return rows.length > 0;
}

// Fetch recent messages (newest 50, returned oldest-first for display)
router.get("/:id/messages", async (req, res) => {
  const channelId = req.params.id;
  if (!(await memberCheck(channelId, req.user.id)))
    return res.status(403).json({ error: "Not a member of this channel's server" });

  const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
  const { rows } = await pool.query(
    `SELECT m.id, m.channel_id, m.user_id, m.content, m.created_at, u.username, u.avatar_color
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = $1
     ORDER BY m.id DESC
     LIMIT $2`,
    [channelId, limit]
  );
  res.json({ messages: rows.reverse().map((m) => ({ ...m, id: String(m.id), user_id: String(m.user_id) })) });
});

// Send a message - persisted, then broadcast over WebSocket to channel subscribers
router.post("/:id/messages", async (req, res) => {
  const channelId = req.params.id;
  const content = (req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "Message cannot be empty" });
  if (content.length > 2000) return res.status(400).json({ error: "Message too long (2000 chars max)" });

  if (!(await memberCheck(channelId, req.user.id)))
    return res.status(403).json({ error: "Not a member of this channel's server" });

  const id = nextId();
  const author = await pool.query(
    "SELECT username, avatar_color FROM users WHERE id = $1",
    [req.user.id]
  );
  const { rows } = await pool.query(
    `INSERT INTO messages (id, channel_id, user_id, content)
     VALUES ($1, $2, $3, $4) RETURNING created_at`,
    [id, channelId, req.user.id, content]
  );

  const message = {
    id,
    channel_id: channelId,
    user_id: req.user.id,
    content,
    created_at: rows[0].created_at,
    username: author.rows[0].username,
    avatar_color: author.rows[0].avatar_color,
  };
  broadcastToChannel(channelId, { op: "MESSAGE_CREATE", data: message });
  res.status(201).json({ message });
});

module.exports = router;
