require("./env").load();

const path = require("path");
const http = require("http");
const express = require("express");
const { initCheck } = require("./db");
const { onlineUserIds, attach } = require("./ws");

const app = express();
app.use(express.json({ limit: "32kb" }));

// Latest Supabase check result, refreshed in the background so /api/health can
// report it without a blocking network call. The status code stays 200 either
// way, so Render's own health check is never the thing that fails.
let supabase = { ok: null, hint: "check pending" };
function checkSupabase() {
  return initCheck().then((report) => {
    supabase = report;
    return report;
  });
}

app.get("/api/health", (req, res) =>
  res.json({ ok: true, supabase: supabase.ok === true ? "ok" : supabase.hint || "unknown" })
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/guilds", require("./routes/guilds"));
app.use("/api/channels", require("./routes/channels"));

// Who's online (any authenticated user) - for the member list
app.get("/api/presence", require("./auth").requireAuth, (req, res) => {
  res.json({ online: onlineUserIds() });
});

// Serve the built React client in production (Render runs one web service)
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => err && next());
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Last-resort net: without this, one stray rejected promise would kill the
// process (Node >= 15) and Render would show 502s.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
attach(server);

checkSupabase()
  .then((report) => {
    if (report.ok) {
      console.log("Supabase connection OK");
    } else {
      console.warn("WARNING: " + report.hint);
      console.warn("The server will keep running, but API calls will fail until this is fixed.");
    }
    server.listen(PORT, () => {
      console.log(`Bonfire server listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Supabase startup check crashed:", err);
    process.exit(1);
  });

// Keep /api/health current, e.g. if the Supabase project gets paused.
setInterval(() => {
  checkSupabase().catch(() => {});
}, 60000).unref();
