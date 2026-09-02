# Social Pulse — Complete Feature Inventory

Reverse-engineered from a full forensic audit of the repository (`D:\Projects\channel-doctor`,
brand "Social Pulse", internal name "Channel Doctor"). Read-only audit — no application code was
modified. Every item below is verified against actual code paths; nothing is assumed from UI alone.

Legend for implementation status used inline where relevant:
`✅` fully implemented · `🟡` partially implemented / cosmetic / persisted-but-inert · `🔌` backend only (no UI) · `🚫` disabled or dead code · `🧪` mock / stub

---

## 1. Authentication & Account

1. **Email/password sign-in** — Clerk `<SignIn>` component (routing=path) rendered on `/sign-in`. ✅
2. **Email/password sign-up** — Clerk `<SignUp>` component (routing=path) rendered on `/sign-up`. ✅
3. **Google sign-in button (custom)** — App-level button calls `signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: /sign-in/sso-callback, redirectUrlComplete: /connect })`; Clerk's own social buttons are hidden via appearance overrides. ✅
4. **SSO callback route handling** — `/sign-in/:rest*` and `/sign-up/:rest*` route patterns swallow Clerk's `/sign-in/sso-callback` and factor/verification paths. ✅
5. **Sign-out from profile dropdown** — `useClerk().signOut({ redirectUrl: "/" })` with loading state ("Signing out…"). ✅
6. **Sign-out from dashboard** — Header "Sign out" button calls the same Clerk sign-out. ✅
7. **Session token bridge (REST)** — `AuthBridge` registers Clerk `getToken()` as the auth getter for all generated API calls (Bearer header). ✅
8. **Session token bridge (Socket.IO)** — Same token getter registered for the socket handshake via `registerSocketTokenGetter`. ✅
9. **Profile dropdown** — Avatar + name + email + "Free plan" badge, menu links (Profile / Account settings / Notifications / Billing), live socket connection status dot, and Log out. Closes on outside click / Escape. ✅
10. **Client-side protected routes** — Dashboard, Saved, Planner, Profile, Settings, Connect redirect to `/sign-in` via `useEffect` when signed out and wrap content in `<SignedIn>`/`<SignedOut>`. ✅
11. **Profile page** — Identity card (avatar, name, email, plan badge, joined date, connected channel), 3 stat cards (reports saved, channel connected, achievements), achievements grid. ✅
12. **Account tab (read-only profile info)** — Name, email, account ID, joined date displayed; password/email management delegated to Clerk's "Manage account". ✅
13. **Export account data** — Settings ActionRow → toast only ("will be emailed within 24 hours"); **no backend endpoint**. 🧪
14. **Delete account** — Settings ActionRow → toast only ("email support@socialpulse.ai"); **no backend endpoint**. 🧪
15. **Billing / plan display** — "Free plan" / "Pro plan" badge derives from `user.plan` (defaults `"free"`); no upgrade/payment flow exists. 🟡

## 2. YouTube Connection

16. **Connect via Google OAuth** — Backend OAuth2 (`youtube.readonly`, `access_type=offline`, `prompt=consent`) with signed state (HMAC, 10-min TTL); consent → callback → channel stored. ✅
17. **OAuth config check** — `GET /api/youtube-oauth/check` (public) returns which creds are configured + computed callback URI; UI shows amber warning when incomplete. ✅
18. **Redirect URI registration guide + copy** — Collapsible guide with the exact callback URI, copy-to-clipboard button, and Google Cloud Console checklist. ✅
19. **OAuth popup postMessage flow** — Connect page posts `youtube_oauth_success`/`youtube_oauth_error` to the opener and closes when opened via `window.open()`. ✅
20. **Same-window OAuth fallback** — When not a popup, success/error params drive the phase machine directly after cleaning the URL via `history.replaceState`. ✅
21. **Auto-detect existing connection** — `POST /api/connected/auto-detect-youtube` re-links the channel from a stored refresh token (exchange → `channels?mine=true`), clearing the token on failure. ✅
22. **Manual channel lookup** — `POST /api/connected/lookup-channel` resolves URL / channel-ID / search to a channel preview. ✅
23. **Manual channel link** — `POST /api/connected/link-channel` saves channel metadata only (no OAuth token); UI warns analytics requiring OAuth won't work. ✅
24. **Disconnect channel (Dashboard)** — Two-step confirm ("Click again to confirm") then `DELETE /api/connected/connect`. ✅
25. **Disconnect channel (Settings)** — One-click disconnect on the Account tab. ✅
26. **Connect success screens** — Connected state shows channel, success checkmark, "Go to Dashboard" / "Manage". ✅
27. **OAuth error mapping** — `decodeErrorParam` maps `access_denied`, `missing_state`, `invalid_state`, `missing_code`, `server_misconfigured`, `no_channel`, `server_error`, `token_exchange_failed:*`, `youtube_api_error:*`. ✅
28. **OAuth inspect / debug** — `GET /api/youtube-oauth/inspect` and `GET /api/connected/debug-oauth` (auth-gated) report token/scope/YouTube API status. ✅

## 3. Channel Analysis (YouTube)

29. **Channel search** — `GET /api/channels/search?q=` handles @handles (`/channels?forHandle=`), URLs (`channel/`/`c/`/`user/` segments), and name search; results cached 30 min. ✅
30. **Channel snapshot** — `GET /api/channels/:id` returns stats (subs, hidden-subs flag, total views, video count, country, published date, banner), derived metrics, health, recent videos (12), view trend, upload cadence. ✅
31. **Health score + status** — 0–100 score from 4 weighted axes (engagement/consistency/growth/performance) → `thriving/healthy/warning/critical`. ✅
32. **Metric grid** — 7 cards: Avg Views/Video (+median), Views÷Subs, Engagement Rate, Recent Growth ratio, Upload Cadence, Best Posting Slot, Health Score. ✅
33. **View trend chart** — Chart.js line of last 25 videos' views (dates on x, K/M-formatted y, index tooltip). ✅
34. **Recent videos list** — Thumbnail cards with duration badge, views/likes/comments, date, and YouTube watch links. ✅
35. **AI growth diagnosis** — On-demand "Run AI analysis" → `GET /api/channels/:id/analysis`: diagnosis paragraph, strengths/weaknesses/opportunities, prioritized next actions, niche + audience insight. ✅
36. **Content ideas generator** — "Generate 8 ideas" → `POST /api/ai/content-ideas` (title/hook/format/why). ✅
37. **Per-video AI breakdown** — `GET /api/channels/:id/video-breakdown` (cached 30 min): title score, hook strength, CTR category, thumbnail critique, verdict per recent upload. ✅
38. **Competitor comparison** — `GET /api/channels/:id/competitors`: finds similar channels, table of subs/avg views/uploads/wk/engagement, AI comparison string, advantages, gaps. ✅

## 4. AI Tools

39. **Title Optimizer** — `POST /api/ai/title-optimizer`: 10 high-CTR titles with click scores (normalized 0–100), style tags, reasoning, plus overall analysis; copy-to-clipboard per title. ✅
40. **Thumbnail A/B (Vision AI)** — `POST /api/ai/thumbnail-ab`: upload/drag-drop/URL thumbnails, client-side downscale (640px, JPEG 0.82) + dominant-color extraction, per-image vision analysis (CTR/clarity/emotion/contrast/text readability), text judge picks winner + confidence. ✅
41. **Retention Mapper** — `POST /api/ai/retention-mapper`: video picker → predicted retention curve chart, dropoffs with severity/cause/fix, hook advice. ✅
42. **Why It Failed** — `POST /api/ai/why-failed`: picks worst video → verdict, gap vs channel average, categorized reasons, fixes, stronger title alternatives. ✅
43. **Hook Generator** — `POST /api/ai/hook-generator`: 8 opening hooks with scores/types/reasoning. Real Groq endpoint; **no frontend UI**. 🔌
44. **Content Optimizer** — `POST /api/ai/content-optimizer`: optimized title, hook, structure, description, SEO keywords, CTR score. Real endpoint; **no frontend UI**. 🔌
45. **SEO Optimizer** — `POST /api/ai/seo-optimizer`: SEO score, keyword table (volume/difficulty/intent), suggested title/description/tags, gaps. Real endpoint; **no frontend UI**. 🔌
46. **Growth Engine** — `POST /api/ai/growth-engine`: growth score, levers (impact/effort/action), funnel gaps, 30-day plan, benchmarks. Real endpoint; **no frontend UI**. 🔌
47. **AI Chat "Doc" coach widget** — Fully built floating chat (suggestions, history, streaming-ish typing, uses live `ai_preferences`) + real `POST /api/ai/chat` backend; **disabled** — `<AiChatWidget />` commented out in MainLayout. 🚫

## 5. Social Analyzer (Instagram / Facebook)

48. **Instagram analysis — Overview tab** — `POST /api/ai/analyze-social`: overall score, headline, summary, category score bars, quick wins, growth strategies with impact/steps. ✅
49. **Instagram — Profile & Bio tab** — Username score + 4 alternative handles, profile branding score + notes, bio score + issues + 3 rewritten bio versions. ✅
50. **Instagram — Content & Reels tab** — Content pillars stacked bar (with strength), weak/overused topics, reel score / hook score / viral probability + reel recommendations. ✅
51. **Instagram — Captions & Hashtags tab** — Caption score + 3 rewritten captions (hook-first/storytelling/question-driven), hashtag score + clusters (click-to-copy). ✅
52. **Instagram — Engagement tab** — Engagement trend, strong categories, numbered actions to boost engagement. ✅
53. **Facebook analysis — Overview tab** — Same scorecard/quick-wins/strategies layout as IG. ✅
54. **Facebook — Page Branding tab** — Page title score, description score, branding improvements. ✅
55. **Facebook — Content Strategy tab** — Recommended posting frequency, best formats, top post types, engagement opportunities, interaction strategy. ✅
56. **Facebook — Growth Roadmap tab** — 30/60/90-day roadmap phases with focus, actions, and KPI chips. ✅
57. **Auto-run from URL params** — `/social?platform=…&handle=…` triggers analysis on mount. ✅
58. **Copy-to-clipboard actions** — Handles, bio versions, improved captions, hashtags. ✅
59. **Social DOCX report export** — `POST /api/reports/generate-social`: branded DOCX (cover, scorecard table, quick wins, disclaimer). ✅
60. **AI-estimation disclaimer + error mapping** — Amber banner stating analysis is AI-estimated (no live API data); client watchdog toast at 130s; mapped error messages (timeout / credentials / 500). ✅

## 6. Reports & Saved Analyses

61. **YouTube DOCX report export** — `POST /api/reports/generate`: executive summary, metrics table, key findings, competitive landscape, recommendations table (priority-colored), growth roadmap, conclusion, recent-videos table; blob download via base64. ✅
62. **Save analysis snapshot** — `POST /api/connected/saved-analyses`: recomputes metrics + health, generates diagnosis via Groq, stores `SavedAnalysis`, and fires an `analysis_completed` notification. ✅
63. **Saved analyses list** — `GET /api/connected/saved-analyses` (latest 50). ✅
64. **Open saved analysis** — Card "Open" navigates to `/channel/:id`. ✅
65. **Delete saved analysis** — `DELETE /api/connected/saved-analyses/:id`, invalidates the list query. ✅
66. **Latest saved snapshot card (Dashboard)** — Shows most recent saved diagnosis + date, links to Saved. ✅

## 7. Planner

67. **30-day forecast** — `GET /api/channels/:id/forecast` (cached 30 min): projected subs/views, confidence, summary, drivers, risks. ✅
68. **7-day content schedule** — `GET /api/channels/:id/content-plan` (cached 30 min): cadence advice + per-day topic/format/hook/why. ✅
69. **Planner gate** — "Connect your channel first" empty state with link to find channel. ✅

## 8. Notifications & Real-time

70. **Notification bell + unread badge** — Header bell (sm+), destructive badge (99+ cap), live-connection dot. ✅
71. **Notification history list** — Panel lists persisted notifications (type icon, severity chip, title/body, relative time, read/unread styling). ✅
72. **Mark one notification read** — `POST /api/notifications/:id/read` (and `/read/:id` alias). ✅
73. **Mark all read** — `POST /api/notifications/read-all` (bell header, footer, and Settings tab). ✅
74. **Delete notification** — `DELETE /api/notifications/:id`. ✅
75. **Manual alert scan** — `POST /api/notifications/scan`: recomputes channel alerts, gates each by `alert_preferences`, dedupes per type within 6h, creates + pushes notifications, returns `{items, unread, created, skipped}`. ✅
76. **Send test notification** — `POST /api/notifications/send-test` fires a real-time push; triggered from Settings via dynamic import. ✅
77. **Socket.IO real-time layer** — Socket.IO on `/socket.io`, Clerk-JWT-verified handshake, per-user rooms `user:<userId>`, `notification` events; reconnect with backoff. ✅
78. **Real-time toast bridge** — `useRealtimeToasts` turns each live notification into a transient global toast (destructive variant for critical). ✅
79. **Live connection indicators** — Bell dot, profile dropdown status, Settings connection card. ✅
80. **Notification channel gating** — `inApp` off → not persisted; `realtime` off → not emitted; email/browser prefs are cosmetic (no delivery infra). ✅/🟡
81. **Alert scan engine rules** — Cadence drop, underperforming streak, growth trending down, low engagement, viral video detection, AI-quota nudge (only when `GROQ_QUOTA_THRESHOLD=true`). ✅

## 9. Settings

82. **AI personality** — 5 personas (consultant/growthhacker/branding/coach/analyst), persisted; drives AI chat persona + social analyzer. ✅
83. **Communication style** — 5 options (direct/detailed/executive/beginner/advanced), persisted; **not consumed** by any backend logic. 🟡
84. **Analysis depth** — 4 options (quick/standard/deep/enterprise) with ~time hints; sent to social analyzer. ✅
85. **AI creativity slider** — 0–100 with labels (Conservative…Experimental); passed to social analyzer + chat temperature. ✅
86. **Response length** — 3 options (concise/balanced/detailed); drives AI chat verbosity. ✅
87. **AI tone** — 4 options (professional/casual/encouraging/direct); drives AI chat tone. ✅
88. **Focus areas** — Multi-chip selector (Growth/Branding/Engagement/Monetization/Audience Building); drives chat + social analyzer. ✅
89. **Auto-recommendations toggle** — Persisted; **no runtime behavior** (dashboard shows no auto-generated recommendations). 🟡
90. **Auto-optimization toggle** — Persisted; **no runtime behavior**. 🟡
91. **Auto-analysis toggle** — Persisted; **no scheduler/trigger**. 🟡
92. **Weekly AI reports toggle** — Persisted; **no report scheduler exists**. 🟡
93. **Monthly AI reports toggle** — Persisted; **no report scheduler exists**. 🟡
94. **AI learning mode toggle** — Persisted; **no learning loop**. 🟡
95. **Content suggestions toggle** — Persisted; gates content-idea suggestions inside AI chat. ✅
96. **Thumbnail suggestions toggle** — Persisted; **not consumed**. 🟡
97. **SEO suggestions toggle** — Persisted; gates SEO keyword suggestions inside AI chat. ✅
98. **AI trend detection toggle** — Persisted; **not consumed**. 🟡
99. **AI growth prediction toggle** — Persisted; gates numerical growth predictions inside AI chat. ✅
100. **Smooth animations toggle** — Persisted under `profile`; **not read** — motion is always on. 🟡
101. **YouTube alert toggles (11)** — Subscriber milestone, subscriber drop, video performance drop, viral video, CTR drop, retention drop, low impressions, monetization, copyright, consistency, growth spike — persisted; those with scan rules gate the alert scan. ✅
102. **Instagram alert toggles (4)** — Follower spike, follower drop, viral reel, engagement drop — persisted; **no live IG integration to act on them**. 🟡
103. **Facebook alert toggles (3)** — Post performance, page growth, engagement — persisted; **no live FB integration**. 🟡
104. **System alert toggles (4)** — Billing, AI quota, storage, security — persisted; only `aiQuota` can trigger (env-gated). 🟡
105. **Notification delivery channels** — In-app (gates persistence), real-time (gates socket emit), email, browser (cosmetic). ✅/🟡
106. **Real-time connection card** — Connection state badge, unread/history counts, Send test / Scan / Mark all read buttons, recent notifications preview (5). ✅
107. **Scan channel button (Alerts tab)** — Runs the alert scan with spinner. ✅
108. **Account tab — connected channel management** — Avatar/title + Disconnect button; empty-state text otherwise. ✅
109. **Account tab — data controls** — Export + Delete rows (toast-only stubs). 🧪
110. **`?tab=` deep links** — `/settings?tab=notifications|account|alerts|ai` preselect the tab (used by profile dropdown). ✅
111. **Sticky save bar** — Bottom-sticky bar with "changes save automatically" / "all changes synced" and Save button; per-toggle auto-save is optimistic. ✅
112. **Settings persistence pipeline** — `GET/PUT /api/settings` → Mongo upserts across 4 collections (`ai_preferences`, `alert_preferences`, `notification_preferences`, `user_settings`), E11000-safe, merged with defaults. ✅

## 10. Design System & UX Infrastructure

113. **Particles background + scan line** — Fixed decorative layer of 20 animated dots + 18s gradient scan line. ✅
114. **Glassmorphism + neon + gradient utilities** — `.glass`, `.glass-strong`, `.glow-primary/accent/text`, `.text-gradient`, `.text-gradient-warm`, `.border-gradient`, `.bg-grid`, `.orb`, `.shimmer`, `.border-pulse`, `.animate-float`. ✅
115. **Page transitions** — Framer-motion route-keyed fade/slide on `<main>`; animated tab content with `AnimatePresence mode="wait"`. ✅
116. **Global error boundary** — Prevents white-screen crashes; shows ⚠️ + message + "Try again". ✅
117. **Toast system** — Radix toast, single-at-a-time (TOAST_LIMIT=1), default/destructive variants, top mobile / bottom-right desktop. ✅
118. **Responsive navigation** — Desktop top nav (md+), animated mobile hamburger drawer, bell hidden < sm. ✅
119. **ChannelAvatar** — `referrerPolicy="no-referrer"` for yt3.ggpht.com + initials/User fallback on error/missing. ✅
120. **`useIsMobile` hook** — 768px media-query hook; **unused anywhere**. 🚫
121. **Dark-only theme** — `document.documentElement.classList.add("dark")` hardcoded; light theme option persisted but never applied. 🟡
122. **Meta/OG tags + assets** — Inter font preconnect, description/OG image, theme-color, favicon/logo. ✅

## 11. API Client & Platform Infrastructure

123. **OpenAPI spec + Orval codegen** — `lib/api-spec/openapi.yaml` drives React Query client (`lib/api-client-react`) and zod schemas (`lib/api-zod`). ✅
124. **Custom fetch layer** — Base-URL resolution, Bearer auth getter, content-type/accept inference, HTML-catch-all guard, structured `ApiError` / `ResponseParseError`, RN-aware body handling. ✅
125. **Backend in-memory cache** — TTL cache for searches, channels, videos, analysis, breakdown, content plan, forecast. ✅
126. **Groq AI service layer** — `jsonCompletion`, `structuredCompletion`, `visionJsonCompletion`, `visionJsonPerImage`, `chatCompletion`; exponential-backoff retry on 429/5xx; defensive JSON extraction. ✅
127. **DOCX generation service** — Branded Word documents via `docx` for both report types (headers, footers, page numbers, tables, shading). ✅
128. **YouTube Data API service** — `/search`, `/channels` (by id + by handle), `/playlistItems`, `/videos`; ISO-duration parsing; 15s timeout. ✅
129. **Metrics derivation engine** — avg/median views, growth ratio, views÷subs, engagement rate, cadence, best day/hour, consistency score. ✅
130. **Health scoring engine** — 4-axis weighted blend (25% each) → score + status. ✅
131. **MongoDB data layer** — Models: `User`, `SavedAnalysis`, `AiPreferences`, `AlertPreferences`, `NotificationPreferences`, `UserSettings`, `UserNotification`; indexed for unread/inbox/user lookups. ✅
132. **Clerk frontend-API proxy** — `/api/__clerk` production proxy for custom-domain Clerk. ✅
133. **Startup credential verification** — Logs which of 6 required credentials are present at boot. ✅
134. **Health check endpoint** — `GET /api/healthz` → `{status:"ok"}`. ✅
135. **API origin resolution** — `VITE_API_ORIGIN` with production localhost guard; used for REST + socket + OAuth start. ✅

## 12. End-to-End Workflows

136. **New-user onboarding** — Sign up (Clerk or Google) → auto-land on `/connect` → Google OAuth consent → channel stored → success → Dashboard unlocked. ✅
137. **Existing-user sign-in** — Sign in → `/dashboard` → connected channel command center (or connect CTA). ✅
138. **Guest analysis journey** — Home search → channel page → full public analysis + AI tools (save/report hidden when signed out). ✅
139. **Creator optimization loop** — Dashboard → full analyzer → diagnosis → title optimizer → thumbnail A/B → retention → why-failed → save snapshot → Saved library. ✅
140. **Alert lifecycle loop** — Configure alert toggles → scan → notifications persisted + socket-pushed → toast + bell badge → mark read/delete → re-scan (dedup 6h). ✅
141. **Social audit workflow** — `/social` → platform pick → analyze (5 parallel Groq calls, concurrency 2) → tabbed deep-dive → DOCX export. ✅
142. **Planner workflow** — Connect channel → `/planner` → forecast + 7-day schedule. ✅
143. **OAuth reconnection workflow** — Visit `/connect` → auto-detect via stored refresh token → channel restored without re-consent (token cleared on failure). ✅

---

*End of inventory — 143 numbered features/workflows. All statuses verified against source; stubs, dead code, and backend-only endpoints are explicitly flagged rather than assumed.*
