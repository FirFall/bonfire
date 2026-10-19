// Good-path check with the real key: health + a read-only login probe. (temporary)
const { spawn } = require("child_process");
const path = require("path");

const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, PORT: String(PORT) }; // real key comes from ~/.config/bonfire/.env

const child = spawn(process.execPath, [path.join(__dirname, "index.js")], { env, cwd: __dirname });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 40 && !/listening/.test(log); i++) await sleep(250);

  const health = await (await fetch(`${BASE}/api/health`)).json();
  console.log("health:", JSON.stringify(health));

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "definitely_no_such_user", password: "password123" }),
  });
  console.log("login with fake user ->", res.status, JSON.stringify(await res.json()));
  console.log(res.status === 401 ? "=> Supabase read path works" : "=> unexpected");

  child.kill();
  await sleep(300);
  console.log("startup log:", log.trim().split("\n")[0]);
})();
