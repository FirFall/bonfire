// Tiny zero-dependency .env loader for local development.
// Searches (first hit per key wins):
//   1. .env.local  (written by `neon deploy`)
//   2. .env
//   3. server/.env.local
//   4. server/.env
// On Render, environment variables are injected directly, so this is a no-op.
const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, ".env.local"),
  path.join(__dirname, ".env"),
];

function loadFile(file) {
  if (!fs.existsSync(file)) return false;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return true;
}

function load() {
  for (const file of CANDIDATES) loadFile(file);
}

module.exports = { load };
