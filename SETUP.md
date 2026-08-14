# Channel Doctor — Local Setup Guide

Works fully locally — **no Replit dependencies**.

## Required environment variables

### `backend/.env` (backend secrets)
```env
PORT=8080
MONGODB_URI=mongodb+srv://USER:PASS@CLUSTER.mongodb.net/
YOUTUBE_API_KEY=AIzaSy...YOUR_YOUTUBE_API_KEY
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
GROQ_API_KEY=gsk_...          # ← REQUIRED for all AI features
LOG_LEVEL=info
SESSION_SECRET=<long-random-string>
# Optional real-time extras
GROQ_QUOTA_THRESHOLD=false   # set "true" to enable the AI-quota system alert scan
```

> **Real-time layer (Socket.IO):** served from the same HTTP server (port 8080,
> path `/socket.io`). The frontend connects with the Clerk session JWT as the
> auth token; no extra env vars required beyond `CLERK_SECRET_KEY` (which the
> socket auth uses to verify the token).

### `frontend/.env` (frontend vars)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_ORIGIN=http://localhost:8080
```

> `backend/.env` is now git-ignored so secrets never get committed.

## Install dependencies (one time)
```bash
cd /d/Projects/channel-doctor
pnpm install
```

## Start the backend (port 8080)
```bash
cd /d/Projects/channel-doctor/backend
pnpm run dev          # builds then starts: `node --enable-source-maps ./dist/index.mjs`
```
- Startup logs confirm: **"Server listening"** + **"All credentials present"** (incl. `GROQ_API_KEY`).

## Start the frontend (port 5173)
```bash
cd /d/Projects/channel-doctor/frontend
pnpm run dev          # `vite --config vite.config.ts --host 0.0.0.0`
```
- Vite proxies `/api/*` → `http://localhost:8080` automatically.

Or from repo root:
```bash
pnpm dev:backend      # starts backend
pnpm dev:frontend     # starts frontend
```

## Health check URLs
- Backend: `http://localhost:8080/api/healthz` → `{"status":"ok"}`
- Backend (via Vite proxy): `http://localhost:5173/api/healthz`
- Frontend: `http://localhost:5173/`

## Test endpoints (curl)
```bash
# Health
curl http://localhost:8080/api/healthz

# YouTube channel search
curl "http://localhost:8080/api/channels/search?q=mrbeast"

# AI optimization (real data via Groq)
curl -X POST http://localhost:8080/api/ai/title-optimizer \
  -H "Content-Type: application/json" -d '{"currentTitle":"How I built a rocket"}'

curl -X POST http://localhost:8080/api/ai/retention-mapper \
  -H "Content-Type: application/json" -d '{"title":"Building a PC in space","durationSeconds":420}'

curl -X POST http://localhost:8080/api/ai/hook-generator \
  -H "Content-Type: application/json" -d '{"topic":"machine learning"}'

curl -X POST http://localhost:8080/api/ai/seo-optimizer \
  -H "Content-Type: application/json" -d '{"topic":"machine learning basics"}'

curl -X POST http://localhost:8080/api/ai/content-optimizer \
  -H "Content-Type: application/json" -d '{"title":"Learn ML in 10 minutes"}'

curl -X POST http://localhost:8080/api/ai/growth-engine \
  -H "Content-Type: application/json" -d '{"channelId":"UCX6OQ3DkcsbYNE6H8uQQuVA"}'

# Social analyzers (Instagram / Facebook)
curl -X POST http://localhost:8080/api/ai/analyze-social \
  -H "Content-Type: application/json" -d '{"platform":"instagram","handle":"mrbeast","depth":"standard"}'

curl -X POST http://localhost:8080/api/ai/analyze-social \
  -H "Content-Type: application/json" -d '{"platform":"facebook","handle":"mrbeast","depth":"standard"}'

# Full channel analysis (uses real YouTube API + AI)
curl "http://localhost:8080/api/channels/UCX6OQ3DkcsbYNE6H8uQQuVA/analysis"
```

## Settings & notifications API (new)
| Endpoint | Purpose |
| --- | --- |
| `GET /api/settings` | Full merged settings for the signed-in user (AI, alerts, notifications, profile) |
| `PUT /api/settings` | Partial update, persisted to MongoDB, returns merged settings |
| `GET /api/notifications` | Notification history + unread count |
| `GET /api/notifications/unread-count` | Unread badge count |
| `POST /api/notifications/read-all` | Mark all read |
| `POST /api/notifications/:id/read` | Mark one read |
| `DELETE /api/notifications/:id` | Delete one |
| `POST /api/notifications/scan` | Re-check the connected channel → creates alerts respecting alert_preferences |
| `POST /api/notifications/send-test` | Fire a test real-time notification over the WebSocket |

Every setting is persisted in MongoDB collections (`user_settings`,
`user_notifications`, `notification_preferences`, `ai_preferences`,
`alert_preferences`) and survives refresh. Changes take effect immediately — the
AI chat personality/tone/verbosity come from `ai_preferences`, alert toggles
gate the alert scan, and the notification channels gate what's persisted/emitted.

## Notes
- **AI provider:** Groq (`llama-3.3-70b-versatile` default, `llama-3.1-8b-instant` for the multi-call social analyzer, `qwen/qwen3.6-27b` for vision). All keyed by a single `GROQ_API_KEY`.
- **Free-tier caveats:** The vision model (thumbnail A/B) is capped ~8000 TPM on the free/on-demand tier — very large images can 413. Upgrade the Groq plan (https://console.groq.com/settings/billing) to remove it. Heavy analysis also benefits from a paid tier's higher rate limits.
- **Auth:** Clerk handles sign-in. Routes under `/api/connected/*`, `/api/settings/*`, `/api/notifications/*` and the OAuth inspect/start require a signed-in session token. Socket.IO handshakes are authenticated with the same Clerk session JWT.
- **Real-time:** After backend code changes, **restart the backend** (`pnpm dev:backend`) so the Socket.IO server + new endpoints load. The frontend Vite server hot-reloads automatically.
