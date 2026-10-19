const { WebSocketServer } = require("ws");
const { isChannelMember } = require("./db");
const { verifyToken } = require("./auth");

// Connected clients: ws -> { userId, username, avatarColor, channels:Set }
const clients = new Map();
// userId -> number of open sockets (a user can have the app open in 2 places)
const onlineUsers = new Map();

let wss = null;

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj, filter = () => true) {
  const payload = JSON.stringify(obj);
  for (const [ws, meta] of clients) {
    if (filter(meta) && ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function broadcastToChannel(channelId, obj) {
  broadcast(obj, (meta) => meta.channels.has(channelId));
}

function setPresence(userId, status) {
  broadcast({ op: "PRESENCE_UPDATE", data: { user_id: userId, status } });
}

// Simple typing throttle: a user may emit TYPING per channel at most every 3s
const lastTyping = new Map();

function attach(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    let payload;
    try {
      payload = verifyToken(token || "");
    } catch {
      ws.close(4001, "Invalid token");
      return;
    }

    const meta = {
      userId: String(payload.sub),
      username: payload.username,
      avatarColor: "#5865f2",
      channels: new Set(),
    };
    clients.set(ws, meta);

    const wasOffline = !onlineUsers.has(meta.userId);
    onlineUsers.set(meta.userId, (onlineUsers.get(meta.userId) || 0) + 1);
    if (wasOffline) setPresence(meta.userId, "online");

    send(ws, { op: "READY", data: { user_id: meta.userId } });

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.op === "SUBSCRIBE") {
        const channelId = String(msg.channel_id || "");
        if ((await isChannelMember(meta.userId, channelId))) {
          meta.channels.add(channelId);
        } else {
          send(ws, { op: "ERROR", data: { message: "Not a member of this channel" } });
        }
      } else if (msg.op === "UNSUBSCRIBE") {
        meta.channels.delete(String(msg.channel_id || ""));
      } else if (msg.op === "TYPING") {
        const channelId = String(msg.channel_id || "");
        const key = `${meta.userId}:${channelId}`;
        const now = Date.now();
        if (now - (lastTyping.get(key) || 0) < 3000) return;
        lastTyping.set(key, now);
        if (await isChannelMember(meta.userId, channelId)) {
          broadcastToChannel(channelId, {
            op: "TYPING_UPDATE",
            data: { channel_id: channelId, user_id: meta.userId, username: meta.username },
          });
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      const remaining = (onlineUsers.get(meta.userId) || 1) - 1;
      if (remaining <= 0) {
        onlineUsers.delete(meta.userId);
        setPresence(meta.userId, "offline");
      } else {
        onlineUsers.set(meta.userId, remaining);
      }
    });

    ws.on("error", () => ws.close());
  });

  return wss;
}

function onlineUserIds() {
  return [...onlineUsers.keys()];
}

module.exports = { attach, broadcastToChannel, onlineUserIds };
