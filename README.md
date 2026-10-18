# Discord Clone

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

1. Postgres running locally, e.g. `docker run -d --name discord-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=discord_clone postgres:16`
2. `cd server && cp .env.example .env && npm install && npm run dev`
3. `cd client && npm install && npm run dev` — open http://localhost:5173

The schema creates itself on first server start.

## Deploy to Render

1. Push this `discord-clone` folder to its own GitHub repo:
   ```
   cd discord-clone
   git init && git add . && git commit -m "Discord clone"
   gh repo create discord-clone --private --source=. --push
   ```
   (or create the repo on github.com and push manually)
2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint**, pick the repo.
3. Render reads `render.yaml`, provisions the web service + Postgres, wires `DATABASE_URL`, and generates a `JWT_SECRET`. Click **Apply**.
4. Once the deploy finishes, open the service URL — you're live.

### Notes

- **Instance plan**: the web service is set to **Starter** ($7/mo) because persistent WebSocket connections need it — Render's free instances spin down after inactivity, which drops live connections. For testing you can switch to free in the dashboard (chat still works, just reconnects after idle).
- The Postgres instance in `render.yaml` is `free`; Render's free Postgres has a 90-day expiry, so switch it to a paid plan for anything long-lived.
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
| `DATABASE_URL` | Render (auto from blueprint) | Postgres connection string |
| `JWT_SECRET` | Render (auto-generated) | Token signing key |
| `PORT` | Render (injected) | HTTP port |
| `WORKER_ID` | optional | Snowflake worker bits (default 1) |
