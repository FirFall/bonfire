import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, setToken } from "./api.js";
import { Gateway } from "./ws.js";
import Login from "./components/Login.jsx";
import GuildSidebar from "./components/GuildSidebar.jsx";
import ChannelSidebar from "./components/ChannelSidebar.jsx";
import Chat from "./components/Chat.jsx";
import MemberList from "./components/MemberList.jsx";

export default function App() {
  const [token, setTok] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  const [guilds, setGuilds] = useState([]);
  const [activeGuildId, setActiveGuildId] = useState(null);
  const [guildData, setGuildData] = useState(null); // {guild, channels, members}
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [typing, setTyping] = useState([]); // [{userId, username, at}]

  const gatewayRef = useRef(null);
  const activeChannelRef = useRef(null);
  const subscribedRef = useRef(null); // channel the gateway is currently subscribed to
  activeChannelRef.current = activeChannelId;

  // ---- auth ----
  function handleLogin(newToken, newUser) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setTok(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    gatewayRef.current?.close();
    gatewayRef.current = null;
    setTok(null);
    setUser(null);
    setGuilds([]);
    setActiveGuildId(null);
  }

  // ---- gateway wiring ----
  useEffect(() => {
    if (!token) return;
    setToken(token);
    const gw = new Gateway(token);
    gatewayRef.current = gw;

    gw.on("MESSAGE_CREATE", (m) => {
      if (m.channel_id === activeChannelRef.current) {
        setMessages((prev) => [...prev, { ...m, id: String(m.id), user_id: String(m.user_id) }]);
      }
    });

    // Re-subscribe to the active channel after a reconnect
    gw.on("CONNECTED", () => {
      if (subscribedRef.current) gw.subscribe(subscribedRef.current);
    });

    gw.on("PRESENCE_UPDATE", ({ user_id, status }) => {      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (status === "online") next.add(String(user_id));
        else next.delete(String(user_id));
        return next;
      });
    });

    gw.on("TYPING_UPDATE", ({ channel_id, user_id, username }) => {
      if (channel_id !== activeChannelRef.current) return;
      const uid = String(user_id);
      setTyping((prev) => [
        ...prev.filter((t) => t.userId !== uid || Date.now() - t.at > 6000),
        { userId: uid, username, at: Date.now() },
      ]);
      setTimeout(
        () => setTyping((prev) => prev.filter((t) => t.userId !== uid || Date.now() - t.at < 5000)),
        6000
      );
    });

    gw.connect();

    // Initial online list
    fetch("/api/presence", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOnlineIds(new Set((d.online || []).map(String))))
      .catch(() => {});

    api.guilds().then((d) => setGuilds(d.guilds)).catch(() => {});

    return () => gw.close();
  }, [token]);

  // ---- load guild detail when active guild changes ----
  useEffect(() => {
    if (!activeGuildId) {
      setGuildData(null);
      setActiveChannelId(null);
      return;
    }
    let stale = false;
    api
      .guild(activeGuildId)
      .then((d) => {
        if (stale) return;
        setGuildData(d);
        setActiveChannelId((prev) =>
          d.channels.some((c) => c.id === prev) ? prev : d.channels[0]?.id || null
        );
      })
      .catch((err) => alert(err.message));
    return () => {
      stale = true;
    };
  }, [activeGuildId]);

  // ---- load messages + subscribe when channel changes ----
  useEffect(() => {
    const gw = gatewayRef.current;
    const channelId = activeChannelId;
    if (!channelId) {
      setMessages([]);
      return;
    }
    let stale = false;
    setMessages([]);
    api.messages(channelId).then((d) => !stale && setMessages(d.messages)).catch(() => {});
    if (gw) {
      if (subscribedRef.current && subscribedRef.current !== channelId) {
        gw.unsubscribe(subscribedRef.current);
      }
      gw.subscribe(channelId);
      subscribedRef.current = channelId;
    }
    return () => {
      stale = true;
    };
  }, [activeChannelId, token]);

  // ---- typing throttle ----
  const lastTypingSent = useRef(0);
  const handleTyping = useCallback(() => {
    const gw = gatewayRef.current;
    const channelId = activeChannelRef.current;
    if (!gw || !channelId) return;
    if (Date.now() - lastTypingSent.current > 3000) {
      lastTypingSent.current = Date.now();
      gw.typing(channelId);
    }
  }, []);

  // ---- guild actions ----
  async function createGuild() {
    const name = prompt("Server name:");
    if (!name?.trim()) return;
    try {
      const { guild } = await api.createGuild(name.trim());
      const list = await api.guilds();
      setGuilds(list.guilds);
      setActiveGuildId(guild.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function joinGuild() {
    const code = prompt("Enter invite code:");
    if (!code?.trim()) return;
    try {
      const { guild } = await api.joinGuild(code.trim());
      const list = await api.guilds();
      setGuilds(list.guilds);
      setActiveGuildId(guild.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function createChannel() {
    const name = prompt("Channel name:");
    if (!name?.trim()) return;
    try {
      const { channel } = await api.createChannel(activeGuildId, name.trim());
      const d = await api.guild(activeGuildId);
      setGuildData(d);
      setActiveChannelId(channel.id);
    } catch (err) {
      alert(err.message);
    }
  }

  if (!token || !user) return <Login onSuccess={handleLogin} />;

  return (
    <div className="app">
      <GuildSidebar
        guilds={guilds}
        activeGuildId={activeGuildId}
        onSelect={setActiveGuildId}
        onCreate={createGuild}
        onJoin={joinGuild}
      />
      <ChannelSidebar
        guild={guildData?.guild}
        channels={guildData?.channels || []}
        activeChannelId={activeChannelId}
        onSelect={setActiveChannelId}
        onCreate={createChannel}
        user={user}
        onLogout={handleLogout}
      />
      <Chat
        channel={guildData?.channels.find((c) => c.id === activeChannelId)}
        messages={messages}
        typing={typing.filter((t) => t.userId !== user.id)}
        onSend={null}
        onTyping={handleTyping}
      />
      {guildData && <MemberList members={guildData.members} onlineIds={onlineIds} />}
    </div>
  );
}
