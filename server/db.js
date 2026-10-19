// Supabase data layer - talks to PostgREST over HTTPS using the project's
// secret API key. No direct Postgres connection needed, so it works from
// networks that block database ports.
//
// Required env vars:
//   SUPABASE_URL        e.g. https://abcdefgh.supabase.co
//   SUPABASE_SECRET_KEY the sb_secret_... key (Settings -> API Keys)
require("./env").load();

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

class SupaError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// One PostgREST call. `path` is the table (or rpc/...), `query` becomes
// ?key=value params, `body` is JSON, `headers` for things like Prefer.
async function rest(path, { method = "GET", query, body, headers = {} } = {}) {
  if (!SUPABASE_URL || !SECRET_KEY)
    throw new SupaError(
      "Supabase is not configured - set SUPABASE_URL and SUPABASE_SECRET_KEY",
      500,
      "NOT_CONFIGURED"
    );

  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: SECRET_KEY,
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new SupaError(`Supabase unreachable: ${err.message}`, 502, "NETWORK");
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new SupaError(
      (data && data.message) || `Supabase responded ${res.status}`,
      res.status,
      data && data.code
    );
  }
  return data;
}

// Insert a row, return it (PostgREST Prefer: return=representation).
function insert(path, row) {
  return rest(path, {
    method: "POST",
    body: row,
    headers: { Prefer: "return=representation" },
  }).then((rows) => rows[0]);
}

// Membership probe used by both the REST routes and the WebSocket gateway.
async function isChannelMember(userId, channelId) {
  const channels = await rest("channels", {
    query: { id: `eq.${channelId}`, select: "guild_id" },
  });
  if (!channels[0]) return false;
  const members = await rest("guild_members", {
    query: {
      guild_id: `eq.${channels[0].guild_id}`,
      user_id: `eq.${userId}`,
      select: "user_id",
    },
  });
  return members.length > 0;
}

// Startup check: verifies the key works and the schema exists, and returns
// human guidance for the two failure modes we can't fix from code.
async function initCheck() {
  try {
    await rest("users", { query: { select: "id", limit: "1" } });
    return { ok: true };
  } catch (err) {
    if (err.code === "NOT_CONFIGURED")
      return { ok: false, hint: "Set SUPABASE_URL and SUPABASE_SECRET_KEY in the environment." };
    if (err.status === 401 || err.status === 403)
      return {
        ok: false,
        hint:
          "Supabase rejected the API key (HTTP " + err.status + "). Most likely the project is " +
          "paused: open the Supabase dashboard and click Restore, or regenerate the secret key " +
          "in Settings -> API Keys and update SUPABASE_SECRET_KEY.",
      };
    if (err.code === "PGRST205" || /relation .* does not exist/i.test(err.message || ""))
      return {
        ok: false,
        hint:
          "Connected to Supabase, but the tables don't exist yet. Open the SQL Editor in the " +
          "Supabase dashboard and run the contents of server/schema.sql once.",
      };
    return { ok: false, hint: `Supabase check failed: ${err.message}` };
  }
}

module.exports = { rest, insert, isChannelMember, initCheck, SupaError };
