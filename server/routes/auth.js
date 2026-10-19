const express = require("express");
const bcrypt = require("bcryptjs");
const { rest, insert } = require("../db");
const { signToken, requireAuth } = require("../auth");
const { nextId } = require("../snowflake");
const ah = require("../async");

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

// Map PostgREST's unique-violation to the same error the SQL layer gave.
function isDuplicate(err) {
  return err.status === 409 || err.code === "23505";
}

router.post("/register", ah(async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!USERNAME_RE.test(username || ""))
    return res.status(400).json({ error: "Username must be 3-32 chars (letters, numbers, . _ -)" });
  if (!EMAIL_RE.test(email || ""))
    return res.status(400).json({ error: "Invalid email" });
  if (!password || password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  const u = username.toLowerCase();
  const e = email.toLowerCase();
  const [byName, byEmail] = await Promise.all([
    rest("users", { query: { username: `eq.${u}`, select: "id" } }),
    rest("users", { query: { email: `eq.${e}`, select: "id" } }),
  ]);
  if (byName.length || byEmail.length)
    return res.status(409).json({ error: "Username or email already taken" });

  const id = nextId();
  const hash = await bcrypt.hash(password, 10);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  let row;
  try {
    row = await insert("users", {
      id,
      username: u,
      email: e,
      password_hash: hash,
      avatar_color: color,
    });
  } catch (err) {
    if (isDuplicate(err))
      return res.status(409).json({ error: "Username or email already taken" });
    throw err;
  }
  const user = publicUser(row);
  res.status(201).json({ token: signToken(user), user });
}));

router.post("/login", ah(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const needle = username.toLowerCase();
  let rows = await rest("users", { query: { username: `eq.${needle}` } });
  if (!rows.length) rows = await rest("users", { query: { email: `eq.${needle}` } });
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });

  const user = publicUser(row);
  res.json({ token: signToken(user), user });
}));

router.get("/me", requireAuth, ah(async (req, res) => {
  const rows = await rest("users", {
    query: { id: `eq.${req.user.id}`, select: "id,username,avatar_color" },
  });
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(rows[0]) });
}));

module.exports = router;
