import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { requireAuth, getUserId, ensureUser } from "../middlewares/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── State signing / verification ─────────────────────────────────────────────

interface OAuthState {
  userId: string;
  returnUrl: string;
  callbackUri: string;
  ts: number;
}

function signState(payload: OAuthState): string {
  const data = `${payload.userId}:${payload.returnUrl}:${payload.callbackUri}:${payload.ts}`;
  const secret = process.env.CLERK_SECRET_KEY ?? "dev-secret";
  const sig = createHmac("sha256", secret).update(data).digest("hex").slice(0, 24);
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString("base64url");
}

function verifyState(raw: string): OAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
    const { sig, ...payload } = parsed as OAuthState & { sig: string };
    const data = `${payload.userId}:${payload.returnUrl}:${payload.callbackUri}:${payload.ts}`;
    const expected = createHmac("sha256", process.env.CLERK_SECRET_KEY ?? "dev-secret")
      .update(data)
      .digest("hex")
      .slice(0, 24);
    if (sig !== expected) {
      console.error("[youtube-oauth] state signature mismatch");
      return null;
    }
    if (Date.now() - payload.ts > STATE_TTL_MS) {
      console.error("[youtube-oauth] state expired");
      return null;
    }
    return payload;
  } catch (e) {
    console.error("[youtube-oauth] verifyState threw:", e);
    return null;
  }
}

function buildCallbackUri(req: import("express").Request): string {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ??
    req.protocol ??
    "https";
  const host = req.get("host") ?? "unknown-host";
  return `${proto}://${host}/api/youtube-oauth/callback`;
}

// ── GET /api/youtube-oauth/check ─────────────────────────────────────────────
// Public endpoint — verifies backend configuration.
router.get("/youtube-oauth/check", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const callbackUri = buildCallbackUri(req);

  res.json({
    clientIdConfigured: !!clientId,
    clientSecretConfigured: !!clientSecret,
    youtubeApiKeyConfigured: !!youtubeApiKey,
    callbackUri,
    allConfigured: !!clientId && !!clientSecret,
  });
});

// ── GET /api/youtube-oauth/inspect ───────────────────────────────────────────
// Auth-required. Full diagnostic trace: DB state + OAuth URL + auto-detect sim.
router.get("/youtube-oauth/inspect", requireAuth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUri = buildCallbackUri(req);

    // Build what the OAuth URL would look like
    let oauthUrl: string | null = null;
    if (clientId) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", callbackUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", YOUTUBE_SCOPE);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", "<signed-state-omitted>");
      oauthUrl = url.toString();
    }

    // Check stored refresh token
    let refreshTokenStatus: string;
    let refreshTokenWorks: boolean | null = null;
    let refreshTokenError: string | null = null;

    if (user.youtubeRefreshToken) {
      refreshTokenStatus = "present";
      // Try to exchange it right now
      const resp = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: user.youtubeRefreshToken,
          client_id: clientId ?? "",
          client_secret: clientSecret ?? "",
          grant_type: "refresh_token",
        }).toString(),
      });
      const data = (await resp.json()) as Record<string, any>;
      if (!resp.ok || data.error) {
        refreshTokenWorks = false;
        refreshTokenError = `${data.error}: ${data.error_description ?? ""}`;
        console.error("[inspect] stored refresh_token exchange failed:", refreshTokenError);
      } else {
        refreshTokenWorks = true;
        console.log("[inspect] stored refresh_token exchange OK for user:", userId);
      }
    } else {
      refreshTokenStatus = "absent";
    }

    const trace = {
      step1_credentials: {
        GOOGLE_CLIENT_ID: !!clientId,
        GOOGLE_CLIENT_SECRET: !!clientSecret,
        YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
      },
      step2_callbackUri: {
        value: callbackUri,
        instruction: "This EXACT URI must be registered in Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs",
      },
      step3_oauthStartEndpoint: {
        method: "GET",
        path: "/api/youtube-oauth/start",
        note: "Called by the Connect button in the UI. Returns { url } which the browser navigates to.",
        generatedUrlPreview: oauthUrl,
        scopes: [YOUTUBE_SCOPE],
        access_type: "offline",
        prompt: "consent",
      },
      step4_callbackEndpoint: {
        method: "GET",
        path: "/api/youtube-oauth/callback",
        note: "Google redirects here after consent. Exchanges code for tokens, saves to DB, redirects to frontend.",
        public: true,
      },
      step5_database: {
        userId,
        channelId: user.channelId ?? null,
        channelTitle: user.channelTitle ?? null,
        youtubeRefreshTokenStatus: refreshTokenStatus,
        youtubeTokenExpiry: user.youtubeTokenExpiry ?? null,
        refreshTokenWorks,
        refreshTokenError,
      },
      step6_autoDetectWouldDo: refreshTokenStatus === "present"
        ? refreshTokenWorks
          ? "PATH 1: Use stored refresh token → exchange for access token → call YouTube API"
          : "PATH 1 FAIL (stale token) → PATH 2: Try Clerk Google token (will fail — no youtube.readonly scope) → PATH 3: youtube_oauth_required"
        : "SKIP PATH 1 (no token) → PATH 2: Try Clerk Google token (will fail — no youtube.readonly scope) → PATH 3: youtube_oauth_required",
      conclusion: refreshTokenStatus === "absent"
        ? "NO REFRESH TOKEN IN DB. The OAuth flow has never completed successfully. You must go to the Connect page and click 'Connect YouTube via Google'."
        : refreshTokenWorks === false
        ? "REFRESH TOKEN IS STALE. Revoke app access at https://myaccount.google.com/permissions then reconnect."
        : "Refresh token is present and working. auto-detect should succeed.",
    };

    console.log("[inspect] trace for user:", userId, JSON.stringify(trace.step5_database));

    res.json(trace);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/youtube-oauth/start ─────────────────────────────────────────────
// Auth-required. Builds a Google OAuth URL and issues a 302 redirect directly
// to Google. The browser navigates here (window.location.href), so Clerk session
// cookies are sent automatically — no fetch() / CORS complications.
router.get("/youtube-oauth/start", requireAuth, async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(503).send("GOOGLE_CLIENT_ID is not configured on the server.");
      return;
    }

    const returnUrl = (req.query.returnUrl as string | undefined)?.trim();
    if (!returnUrl) {
      res.status(400).send("Missing returnUrl query parameter.");
      return;
    }

    const userId = getUserId(req);
    await ensureUser(userId);

    const callbackUri = buildCallbackUri(req);
    const state = signState({ userId, returnUrl, callbackUri, ts: Date.now() });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", YOUTUBE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    console.log("[youtube-oauth/start] ✓ Redirecting to Google OAuth");
    console.log("[youtube-oauth/start]   userId            :", userId);
    console.log("[youtube-oauth/start]   redirect_uri EXACT:", callbackUri);
    console.log("[youtube-oauth/start]   returnUrl         :", returnUrl);
    console.log("[youtube-oauth/start]   full Google URL   :", url.toString());

    // 302 → browser follows to Google consent screen
    res.redirect(302, url.toString());
  } catch (err) {
    next(err);
  }
});

// ── GET /api/youtube-oauth/callback ──────────────────────────────────────────
// PUBLIC — no Clerk auth. Google redirects here after user grants/denies access.
router.get("/youtube-oauth/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const stateRaw = req.query.state as string | undefined;
  const errorParam = req.query.error as string | undefined;

  console.log("[youtube-oauth/callback] ──────── CALLBACK RECEIVED ────────");
  console.log("[youtube-oauth/callback]   code present  :", !!code);
  console.log("[youtube-oauth/callback]   state present :", !!stateRaw);
  console.log("[youtube-oauth/callback]   error param   :", errorParam ?? "none");

  let returnUrl = "/";

  try {
    if (!stateRaw) {
      console.error("[youtube-oauth/callback] FAIL: missing state param");
      res.redirect(`/?youtube_error=missing_state`);
      return;
    }

    const state = verifyState(stateRaw);
    if (!state) {
      res.redirect(`/?youtube_error=invalid_state`);
      return;
    }

    returnUrl = state.returnUrl;
    console.log("[youtube-oauth/callback]   userId        :", state.userId);
    console.log("[youtube-oauth/callback]   callbackUri   :", state.callbackUri);
    console.log("[youtube-oauth/callback]   returnUrl     :", returnUrl);

    if (errorParam) {
      console.warn("[youtube-oauth/callback] FAIL: Google returned error:", errorParam);
      res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent(errorParam)}`);
      return;
    }

    if (!code) {
      console.error("[youtube-oauth/callback] FAIL: missing code param");
      res.redirect(`${returnUrl}?youtube_error=missing_code`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[youtube-oauth/callback] FAIL: credentials not configured at callback time");
      res.redirect(`${returnUrl}?youtube_error=server_misconfigured`);
      return;
    }

    // ── Step 3: Exchange code for tokens ──────────────────────────────────────
    console.log("[youtube-oauth/callback] STEP 3: exchanging code for tokens...");

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: state.callbackUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokens = (await tokenRes.json()) as Record<string, any>;

    if (!tokenRes.ok || tokens.error) {
      console.error("[youtube-oauth/callback] STEP 3 FAIL: token exchange error");
      console.error("[youtube-oauth/callback]   HTTP status :", tokenRes.status);
      console.error("[youtube-oauth/callback]   error       :", tokens.error);
      console.error("[youtube-oauth/callback]   description :", tokens.error_description);
      console.error("[youtube-oauth/callback]   NOTE: If error is 'redirect_uri_mismatch', the URI");
      console.error("[youtube-oauth/callback]   registered in Google Cloud Console does not match:", state.callbackUri);
      const detail = tokens.error_description ?? tokens.error ?? "unknown";
      res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent("token_exchange_failed: " + detail)}`);
      return;
    }

    const accessToken = tokens.access_token as string;
    const refreshToken = (tokens.refresh_token as string | undefined) ?? null;
    const expiresIn = (tokens.expires_in as number) ?? 3600;

    console.log("[youtube-oauth/callback] STEP 3 OK: tokens received");
    console.log("[youtube-oauth/callback]   access_token present :", !!accessToken);
    console.log("[youtube-oauth/callback]   refresh_token present:", !!refreshToken);
    console.log("[youtube-oauth/callback]   expires_in           :", expiresIn, "seconds");

    if (!refreshToken) {
      console.warn("[youtube-oauth/callback] WARNING: Google did NOT return a refresh_token.");
      console.warn("[youtube-oauth/callback]   This usually means the user previously authorized this app.");
      console.warn("[youtube-oauth/callback]   Fix: revoke at https://myaccount.google.com/permissions and retry.");
      console.warn("[youtube-oauth/callback]   The flow will continue with only an access_token (short-lived).");
    }

    // ── Step 4: Call YouTube API ──────────────────────────────────────────────
    console.log("[youtube-oauth/callback] STEP 4: calling YouTube channels.list...");

    const ytRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const ytData = (await ytRes.json()) as Record<string, any>;

    console.log("[youtube-oauth/callback]   YouTube HTTP status:", ytRes.status);

    if (!ytRes.ok) {
      const detail = ytData?.error?.message ?? ytRes.status;
      console.error("[youtube-oauth/callback] STEP 4 FAIL: YouTube API error:", ytRes.status, ytData?.error?.message);
      console.error("[youtube-oauth/callback]   Full error:", JSON.stringify(ytData?.error));
      res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent("youtube_api_error: " + detail)}`);
      return;
    }

    const item = ytData.items?.[0];
    if (!item) {
      console.warn("[youtube-oauth/callback] STEP 4 FAIL: no YouTube channel returned.");
      console.warn("[youtube-oauth/callback]   ytData.items:", JSON.stringify(ytData.items));
      console.warn("[youtube-oauth/callback]   This account has no YouTube channel.");
      res.redirect(`${returnUrl}?youtube_error=no_channel`);
      return;
    }

    const channelId = item.id as string;
    const channelTitle = (item.snippet?.title ?? null) as string | null;
    const channelThumbnail = (
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null
    ) as string | null;
    const subscriberCount = String(item.statistics?.subscriberCount ?? "0");

    console.log("[youtube-oauth/callback] STEP 4 OK: channel found");
    console.log("[youtube-oauth/callback]   channelId   :", channelId);
    console.log("[youtube-oauth/callback]   channelTitle:", channelTitle);
    console.log("[youtube-oauth/callback]   subscribers :", subscriberCount);

    // ── Step 5: Save to DB ────────────────────────────────────────────────────
    console.log("[youtube-oauth/callback] STEP 5: saving to DB...");

    await db
      .update(usersTable)
      .set({
        channelId,
        channelTitle,
        channelThumbnail,
        youtubeRefreshToken: refreshToken,
        youtubeTokenExpiry: new Date(Date.now() + expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, state.userId));

    console.log("[youtube-oauth/callback] STEP 5 OK: DB updated for user:", state.userId);
    console.log("[youtube-oauth/callback]   youtubeRefreshToken saved:", !!refreshToken);

    // ── Redirect to frontend ──────────────────────────────────────────────────
    const successUrl = new URL(returnUrl);
    successUrl.searchParams.set("youtube_success", "1");
    successUrl.searchParams.set("channel_title", channelTitle ?? "");
    successUrl.searchParams.set("subscriber_count", subscriberCount);

    console.log("[youtube-oauth/callback] ✓ SUCCESS — redirecting to:", successUrl.toString());
    res.redirect(successUrl.toString());
  } catch (err) {
    console.error("[youtube-oauth/callback] UNEXPECTED ERROR:", err);
    try {
      res.redirect(`${returnUrl}?youtube_error=server_error`);
    } catch {
      res.status(500).send("Internal error during YouTube OAuth callback.");
    }
  }
});

export default router;
