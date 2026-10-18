let token = null;

export function setToken(t) {
  token = t;
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (u, e, p) => request("POST", "/auth/register", { username: u, email: e, password: p }),
  login: (u, p) => request("POST", "/auth/login", { username: u, password: p }),
  guilds: () => request("GET", "/guilds"),
  createGuild: (name) => request("POST", "/guilds", { name }),
  joinGuild: (code) => request("POST", "/guilds/join", { invite_code: code }),
  guild: (id) => request("GET", `/guilds/${id}`),
  createChannel: (guildId, name) => request("POST", `/guilds/${guildId}/channels`, { name }),
  messages: (channelId) => request("GET", `/channels/${channelId}/messages`),
  sendMessage: (channelId, content) =>
    request("POST", `/channels/${channelId}/messages`, { content }),
};
