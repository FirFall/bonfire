const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// DATABASE_URL is provided by Render (managed Postgres).
// For local dev: postgresql://user:password@localhost:5432/discord_clone
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.PGHOST || "localhost",
        port: process.env.PGPORT || 5432,
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "postgres",
        database: process.env.PGDATABASE || "discord_clone",
      }
);

// Idempotent schema bootstrap - runs on startup, safe to run repeatedly.
const SCHEMA = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

async function initSchema() {
  await pool.query(SCHEMA);
}

module.exports = { pool, initSchema };
