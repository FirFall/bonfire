const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { signToken, requireAuth } = require("../auth");
const { nextId } = require("../snowflake");

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = [
  "#5865f2", "#57f287", "#fee75c", "#eb459e",
  "#ed4245", "#e67e22", "#1abc9c", "#9b59b6",
];

function publicUser(row) {
  return { id: String(row.id), username: row.username, avatar_color: row.avatar_color };
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!USERNAME_RE.test(username || ""))
      return res.status(400).json({ error: "Username must be 3-32 chars (letters, numbers, . _ -)" });
    if (!EMAIL_RE.test(email || ""))
      return res.status(400).json({ error: "Invalid email" });
    if (!password || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await pool.query(
      "SELECT 1 FROM users WHERE username = $1 OR email = $2",
      [username.toLowerCase(), email.toLowerCase()]
    );
    if (existing.rowCount)
      return res.status(409).json({ error: "Username or email already taken" });

    const id = nextId();
    const hash = await bcrypt.hash(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const { rows } = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, avatar_color`,
      [id, username.toLowerCase(), email.toLowerCase(), hash, color]
    );
    const user = publicUser(rows[0]);
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = $1 OR email = $1",
      [username.toLowerCase()]
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash)))
      return res.status(401).json({ error: "Invalid credentials" });

    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, avatar_color FROM users WHERE id = $1",
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(rows[0]) });
});

module.exports = router;
