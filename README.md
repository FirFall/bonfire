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

1. Postgres running locally, e.g. `docker run -d --name bonfire-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bonfire postgres:16`
2. `cd server && cp .env.example .env && npm install && npm run dev`
3. `cd client && npm install && npm run dev` — open http://localhost:5173

The schema creates itself on first server start.

## Deploy to Render

1. The code is already pushed to GitHub at **https://github.com/FirFall/bonfire**
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**, connect GitHub and pick the `bonfire` repo.
3. Render reads `render.yaml` and will create the web service (`bonfire`, free plan). It **won't** create a Postgres DB (we removed that section).
4. After the service is created, go to its **Environment** tab and replace `PASTE_YOUR_NEON_CONNECTION_STRING_HERE` with your Neon PostgreSQL connection string.
5. Click **Manual Deploy → Deploy latest commit** to restart with the new DB.
6. Once it shows "Live", open the service URL — Bonfire is up!

### Notes

- **Instance plan**: both services are on Render's **Free** plan ($0). The catch: free web services spin down after ~15 minutes with no traffic, which drops live chat connections. Bonfire handles this gracefully — the client auto-reconnects (brief gap, then it's back). If you ever want always-on chat, bump the web service to Starter ($7/mo) in its settings.
- **Database**: Using external free Postgres from [Neon](https://neon.tech) (500 MB, never pauses, no credit card). Get the connection string from the Neon dashboard and paste it into Render's Environment variables as `DATABASE_URL`. The schema auto-creates on boot, so no migration step needed.
- The schema auto-creates on boot, so there's no migration step.

## Architecture

```
client (React)  ──REST──▶  server (Express)  ──▶  Postgres
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
| `DATABASE_URL` | Render (set manually to Wispbyte) | Postgres connection string |
| `JWT_SECRET` | Render (auto-generated) | Token signing key |
| `PORT` | Render (injected) | HTTP port |
| `WORKER_ID` | optional | Snowflake worker bits (default 1) |
