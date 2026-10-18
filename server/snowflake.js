// Discord-style snowflake IDs: (timestamp - epoch) << 22 | worker << 12 | counter
// Chronologically sortable, unique across restarts. Returned as strings
// so they survive JSON round-trips without losing BigInt precision.
const EPOCH = 1420070400000n; // Discord's epoch, why not
const WORKER_ID = BigInt(process.env.WORKER_ID || 1) & 0xfffn;

let lastTs = 0n;
let counter = 0n;

function nextId() {
  const ts = BigInt(Date.now()) - EPOCH;
  if (ts === lastTs) {
    counter = (counter + 1n) & 0xfffn;
  } else {
    counter = 0n;
    lastTs = ts;
  }
  return ((ts << 22n) | (WORKER_ID << 12n) | counter).toString();
}

// Short human-friendly invite code, e.g. "aK3xP9zQ"
function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const bytes = require("crypto").randomBytes(8);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

module.exports = { nextId, inviteCode };
