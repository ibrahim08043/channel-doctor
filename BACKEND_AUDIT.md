# Channel Doctor — Backend Audit Report

Date: 2026-08-02

## What was broken & why

### 1. All AI features failed with `AI_INTEGRATIONS_OPENAI_BASE_URL must be set`
- **Cause:** The backend used the OpenAI SDK (`@workspace/integrations-openai-ai-server` → `openai`). It looked for `OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL`. A stale Replit artifact build threw this error. The `.env` value was actually a **Groq** key (`gsk_...`) stored under `OPENAI_API_KEY`.
- **Fix:** Replaced the OpenAI SDK with `groq-sdk`, reading `GROQ_API_KEY`. Removed the `@workspace/integrations-openai-ai-server` + `@workspace/integrations-openai-ai-react` packages, the `openai` npm dependency, and all `OPENAI_*` / `AI_INTEGRATIONS_*` env vars.

### 2. Instagram / Facebook analyzer returned empty results
- **Cause:** `reports.controller.analyzeSocial` made ONE LLM call asking for a huge nested object. The model returned partial/flat JSON, so the frontend got no `instagramInsights` / `facebookInsights`.
- **Fix:** Split into focused structured calls per section (overview / profile / content / captions / engagement for IG; overview + insights for FB), run sequentially, merge with default-fill.

### 3. Auth leaked to all routes behind `/api` → 401s
- **Cause:** `connected.routes.ts` used `router.use(requireAuth)` **without a path prefix**. Express mounts every sub-router at `/`, so that bare `use` intercepted every request hitting the main router after it (reports, youtube-oauth, and any unmatched path) → `{"error":"Unauthorized"}` even on public routes.
- **Fix:** Scoped to `router.use("/connected", requireAuth)`.

### 4. Groq rate limits (HTTP 429) during multi-call analysis
- **Cause:** The free Groq tier throttles `llama-3.3-70b` / `qwen3.6-27b` hard (TPM/RPM). Parallel calls or heavy retries tripped it.
- **Fix:** Social analyzer uses `llama-3.1-8b-instant` (high free-tier ceiling), runs calls sequentially with spacing, and the AI layer retries 429/5xx with exponential backoff.

### 5. Structured-output validation failures
- **Cause:** Groq strict `json_schema` rejected its own output for large nested schemas (HTTP 400 "Generated JSON does not match").
- **Fix:** Switched to reliable JSON-object mode + schema-as-hint + defensive extraction + default-fill.

### 6. Thumbnail A/B (vision) broke after switching models
- **Cause:** Vision requires the `qwen/qwen3.6-27b` model; the fast text model rejects image content.
- **Fix:** Vision endpoint explicitly uses `VISION_MODEL`. **Account tier caveat:** the free/on-demand tier caps the vision model at ~8000 TPM, and two full-size images can exceed it (HTTP 413). Works with small images or after upgrading the Groq plan.

### 7. Competitors endpoint returned `comparison` as an object instead of a string
- **Fix:** Uses structured completion + shape normalization (`comparison` forced to string, `advantages`/`gaps` to arrays).

## Missing / required API keys

| Key | Platform | Status | Where to get it |
|-----|----------|--------|-----------------|
| `GROQ_API_KEY` | Groq (LLM) | ✅ Present in backend/.env | https://console.groq.com/keys |
| `YOUTUBE_API_KEY` | Google/YouTube | ✅ Present | Google Cloud Console → APIs & Services → YouTube Data API v3 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (YouTube connect) | ✅ Present | Google Cloud Console → Credentials |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | Clerk (auth) | ✅ Present | Clerk dashboard |
| `MONGODB_URI` | MongoDB | ✅ Present | MongoDB Atlas |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk (frontend) | ✅ Present in frontend/.env | Clerk dashboard |

## Instagram / Facebook live-data keys (NOT used — analyzer is AI-estimated by design)
The UI states the analysis is "AI-estimated based on general platform patterns — not live API data." If you want **live** data:
- **Instagram Graph API:** `INSTAGRAM_ACCESS_TOKEN` — requires a Facebook Developer account, an Instagram Business account, and an app in the Meta for Developers dashboard (https://developers.facebook.com). Instagram Graph API does **not** allow public unauthenticated profile scraping; you need an access token for your own business account.
- **Facebook Graph API:** `FB_PAGE_ACCESS_TOKEN` + `FB_PAGE_ID` — Meta for Developers → your app → Graph API Explorer → generate a page access token (https://developers.facebook.com/tools/explorer).

These are optional and not required for the current analyzer to work.

## Settings & notifications (added 2026-08-04)

New MongoDB collections: `user_settings`, `user_notifications`,
`notification_preferences`, `ai_preferences`, `alert_preferences`.

| Endpoint | Status |
|----------|--------|
| `GET /api/settings` | ✅ auth-protected, returns merged settings |
| `PUT /api/settings` | ✅ auth-protected, partial upsert |
| `GET /api/notifications` | ✅ auth-protected |
| `GET /api/notifications/unread-count` | ✅ auth-protected |
| `POST /api/notifications/read-all` | ✅ auth-protected |
| `POST /api/notifications/:id/read` | ✅ auth-protected |
| `DELETE /api/notifications/:id` | ✅ auth-protected |
| `POST /api/notifications/scan` | ✅ auth-protected |
| `POST /api/notifications/send-test` | ✅ auth-protected |

Real-time layer: Socket.IO mounted on the same HTTP server (`/socket.io`),
handshake authenticated via `verifyToken` from `@clerk/backend`. Per-user rooms
`user:<userId>` receive `notification` events. `aiChat` now reads the user's
`ai_preferences` (personality, tone, response length, creativity, focus areas,
suggestion/growth-prediction toggles) so the AI settings page has real effect.

## Endpoint status (all verified returning 200)

| Endpoint | Status |
|----------|--------|
| `GET /api/healthz` | ✅ 200 |
| `GET /api/channels/search?q=` | ✅ 200 |
| `GET /api/channels/:id` | ✅ 200 |
| `GET /api/channels/:id/analysis` | ✅ 200 |
| `GET /api/channels/:id/video-breakdown` | ✅ 200 |
| `GET /api/channels/:id/competitors` | ✅ 200 |
| `GET /api/channels/:id/content-plan` | ✅ 200 |
| `GET /api/channels/:id/forecast` | ✅ 200 |
| `POST /api/ai/title-optimizer` | ✅ 200 |
| `POST /api/ai/thumbnail-ab` | ✅ 200 (vision; see TPM caveat) |
| `POST /api/ai/retention-mapper` | ✅ 200 |
| `POST /api/ai/content-ideas` | ✅ 200 |
| `POST /api/ai/why-failed` | ✅ 200 |
| `POST /api/ai/hook-generator` | ✅ 200 (new) |
| `POST /api/ai/content-optimizer` | ✅ 200 (new) |
| `POST /api/ai/seo-optimizer` | ✅ 200 (new) |
| `POST /api/ai/growth-engine` | ✅ 200 (new) |
| `POST /api/ai/chat` | ✅ 200 |
| `POST /api/ai/analyze-social` | ✅ 200 (Instagram + Facebook complete) |
| `POST /api/reports/generate-social` | ✅ 200 |
| `POST /api/reports/generate` | ✅ 200 |
| `GET /api/youtube-oauth/check` | ✅ 200 |

Auth-protected (require Clerk token): `/api/connected/*`, `GET /api/youtube-oauth/inspect`, `GET /api/youtube-oauth/start`.

## Known minor mismatches (not runtime-breaking)
- Generated client `useLinkChannel` points at `POST /api/connected/connect`; the backend route is `POST /api/connected/link-channel`. The UI uses a raw `fetch("/api/connected/link-channel")` so it works. Re-generating the OpenAPI client would reconcile this.
