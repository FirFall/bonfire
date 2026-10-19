// Reproduce the Render failure locally: broken Supabase key, then hit the
// endpoints that were crashing the process. (temporary)
const { spawn } = require("child_process");
const path = require("path");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

const PORT = 3999;
const JWT_SECRET = "crash-test-secret";
const BASE = `http://127.0.0.1:${PORT}`;
const token = jwt.sign({ sub: "1234567890", username: "tester" }, JWT_SECRET, { expiresIn: "1h" });

const env = {
  ...process.env,
  PORT: String(PORT),
  JWT_SECRET,
  SUPABASE_SECRET_KEY: "sb_secret_definitely_wrong_key", // simulates the deployed misconfiguration
};

const child = spawn(process.execPath, [path.join(__dirname, "index.js")], { env, cwd: __dirname });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(p, opts = {}) {
  try {
    const res = await fetch(BASE + p, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      signal: AbortSignal.timeout(20000),
    });
    let body = null;
    try { body = await res.json(); } catch {}
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: e.name };
  }
}

(async () => {
  for (let i = 0; i < 40 && !/listening/.test(log); i++) await sleep(250);
  console.log("server started:", /listening/.test(log));

  console.log("health:", JSON.stringify(await req("/api/health")));
  console.log("GET /api/auth/me (was crashing):", JSON.stringify(await req("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })));
  await sleep(500);
  console.log("health after /me (server must still be up):", JSON.stringify(await req("/api/health")));
  console.log("GET /api/guilds (was crashing):", JSON.stringify(await req("/api/guilds", { headers: { Authorization: `Bearer ${token}` } })));
  await sleep(500);
  console.log("health after /guilds:", JSON.stringify(await req("/api/health")));

  // WebSocket SUBSCRIBE triggers a Supabase lookup - the old code died here.
  await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${token}`);
    const t = setTimeout(() => { ws.terminate(); resolve(); }, 15000);
    ws.on("message", (d) => {
      const m = JSON.parse(d.toString());
      console.log("ws ->", JSON.stringify(m));
      if (m.op === "ERROR") { clearTimeout(t); ws.close(); resolve(); }
    });
    ws.on("open", () => ws.send(JSON.stringify({ op: "SUBSCRIBE", channel_id: "1" })));
    ws.on("error", (e) => { console.log("ws error:", e.message); clearTimeout(t); resolve(); });
  });
  await sleep(500);
  console.log("health after ws subscribe (server must still be up):", JSON.stringify(await req("/api/health")));

  child.kill();
  await sleep(300);
  console.log("process exited?", child.exitCode !== null, "exitCode:", child.exitCode);
  console.log("--- server log ---");
  console.log(log.trim().split("\n").slice(0, 12).join("\n"));
})();
