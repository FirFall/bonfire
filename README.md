# Bonfire 🔥

A Discord-style chat app: servers (guilds), text channels, real-time messaging via WebSockets, presence, typing indicators, and invite codes. Built for one-click deploy on [Render](https://render.com).

## Stack

- **Backend**: Node.js, Express, `ws` (WebSockets), Postgres (`pg`), JWT auth, bcrypt
- **Frontend**: React 18 + Vite, custom WebSocket gateway client with auto-reconnect
- **Infra**: Single Render Web Service (serves API + WebSocket + built frontend) + Render Postgres

## Features

- Register / login (JWT, 30-day tokens)
- Create servers, auto-created `#general` channel, 8-char invite codes to join
- Create text channels, real-time chat with message grouping by author
- Presence (online/offline dots) and typing indicators
- Snowflake-style message IDs (chronologically sortable, like real Discord)
- Auto-reconnecting WebSocket with exponential backoff

## Run locally

1. `cd server && cp .env.example .env` and fill in `SUPABASE_URL` + `SUPABASE_SECRET_KEY` from your Supabase dashboard (**Project Settings → API Keys**).
2. Run `server/schema.sql` once in the Supabase SQL Editor (dashboard → SQL Editor → paste → Run).
3. `cd server && npm install && npm run dev`
4. `cd client && npm install && npm run dev` — open http://localhost:5173

## Deploy to Render

1. The code is already pushed to GitHub at **https://github.com/FirFall/bonfire**
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**, connect GitHub and pick the `bonfire` repo.
3. Render reads `render.yaml` and will create the web service (`bonfire`, free plan).
4. After the service is created, go to its **Environment** tab and replace the two placeholders:
   - `SUPABASE_URL` → your Project URL, e.g. `https://abcdefgh.supabase.co` (Supabase dashboard → **Project Settings → API Keys**)
   - `SUPABASE_SECRET_KEY` → your secret key, the `sb_secret_...` one (same page — keep it server-side only!)
5. Make sure `server/schema.sql` has been run once in the Supabase SQL Editor.
6. Click **Manual Deploy → Deploy latest commit**.
7. Once it shows "Live", open the service URL — Bonfire is up!

### Notes

- **Instance plan**: the web service is on Render's **Free** plan ($0). The catch: free web services spin down after ~15 minutes with no traffic, which drops live chat connections. Bonfire handles this gracefully — the client auto-reconnects (brief gap, then it's back). If you ever want always-on chat, bump the web service to Starter ($7/mo) in its settings.
- **Database**: [Supabase](https://supabase.com) free tier (500 MB). The backend talks to Supabase's HTTPS API with the secret key — no direct database connection, so it works from any network. You run `server/schema.sql` once in the SQL Editor (there's no auto-create on boot, since SQL can't run over the REST API).
- **Free Supabase projects pause after ~7 days of inactivity** — while paused, logins stop working until you open the dashboard and click **Restore**. Using the app counts as activity, so an active app stays unpaused.
- **API keys**: the `sb_secret_...` key is server-side only (Render env, never in the client or the repo).

## Architecture

```
client (React)  ──REST──▶  server (Express)  ──HTTPS──▶  Supabase (PostgREST)
       │                        ▲
       └────WebSocket /ws───────┘
                 │
          server broadcasts MESSAGE_CREATE,
          PRESENCE_UPDATE, TYPING_UPDATE
```

- Messages are POSTed over REST, persisted, then broadcast to every WebSocket subscribed to that channel (including the sender).
- Membership is checked on every REST call and again on every WS `SUBSCRIBE`.
- One process serves everything, so Render's single web service covers the whole app.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | Render (set manually) | Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Render (set manually) | Supabase secret API key (`sb_secret_...`) — server-side only |
| `JWT_SECRET` | Render (auto-generated) | Token signing key |
| `PORT` | Render (injected) | HTTP port |
| `WORKER_ID` | optional | Snowflake worker bits (default 1) |
