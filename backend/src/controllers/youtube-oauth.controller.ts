import type { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
import { requireAuth, getUserId, ensureUser } from "../middleware/auth";
import { User } from "@workspace/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthState { userId: string; returnUrl: string; callbackUri: string; ts: number; }

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
    const expected = createHmac("sha256", process.env.CLERK_SECRET_KEY ?? "dev-secret").update(data).digest("hex").slice(0, 24);
    if (sig !== expected) return null;
    if (Date.now() - payload.ts > STATE_TTL_MS) return null;
    return payload;
  } catch { return null; }
}

function buildCallbackUri(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ?? req.protocol ?? "https";
  const host = req.get("host") ?? "unknown-host";
  const uri = `${proto}://${host}/api/youtube-oauth/callback`;
  console.log("[youtube-oauth] buildCallbackUri: proto=" + proto + " host=" + host + " → " + uri);
  return uri;
}

export async function checkConfig(req: Request, res: Response) {
  res.json({
    clientIdConfigured: !!process.env.GOOGLE_CLIENT_ID,
    clientSecretConfigured: !!process.env.GOOGLE_CLIENT_SECRET,
    youtubeApiKeyConfigured: !!process.env.YOUTUBE_API_KEY,
    callbackUri: buildCallbackUri(req),
    allConfigured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
  });
}

export async function inspectOauth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUri = buildCallbackUri(req);
    let refreshTokenStatus: string; let refreshTokenWorks: boolean | null = null;
    if (user.youtubeRefreshToken) {
      refreshTokenStatus = "present"; const resp = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: user.youtubeRefreshToken, client_id: clientId ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", grant_type: "refresh_token" }).toString() });
      const data = (await resp.json()) as Record<string, any>;
      refreshTokenWorks = resp.ok && !data.error;
    } else { refreshTokenStatus = "absent"; }
    res.json({ step1_credentials: { GOOGLE_CLIENT_ID: !!clientId, GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET, YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY }, step2_callbackUri: { value: callbackUri, instruction: "This EXACT URI must be registered in Google Cloud Console" }, step5_database: { userId, channelId: user.channelId, channelTitle: user.channelTitle, youtubeRefreshTokenStatus: refreshTokenStatus, refreshTokenWorks } });
  } catch (err) { next(err); }
}

export async function startOauth(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) { res.status(503).send("GOOGLE_CLIENT_ID is not configured."); return; }
    const returnUrl = (req.query.returnUrl as string | undefined)?.trim();
    if (!returnUrl) { res.status(400).send("Missing returnUrl query parameter."); return; }
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
    console.log("[youtube-oauth] start: userId=" + userId + " returnUrl=" + returnUrl);
    console.log("[youtube-oauth] start: callbackUri (Google redirect_uri)=" + callbackUri);
    console.log("[youtube-oauth] start: Google OAuth URL=" + url.toString());
    // Always return JSON. Mobile clients send Accept: application/json and
    // cannot follow 302 redirects with auth headers. Cloudflare/Render may
    // strip or rewrite the Accept header, so we no longer branch on it.
    res.json({ url: url.toString() });
  } catch (err) { next(err); }
}

/**
 * Redirect the user back to the mobile app (or web) after OAuth completes.
 *
 * CRITICAL: We return an HTML page with a JavaScript redirect instead of an
 * HTTP 302 redirect. This is required because:
 *   - Expo's `WebBrowser.openAuthSessionAsync()` monitors in-app browser
 *     navigation events to detect when the redirect URL is reached.
 *   - An HTTP 302 redirect to a custom scheme (socialpulse://) causes the
 *     in-app browser to attempt navigation, but the redirect event is NOT
 *     reliably intercepted by `openAuthSessionAsync`, leaving the browser
 *     stuck on a loading page.
 *   - An HTML page with `window.location.href` triggers a client-side
 *     navigation that IS properly intercepted, closing the browser and
 *     returning control to the app.
 *
 * The HTML page also includes:
 *   - A `<meta http-equiv="refresh">` fallback for browsers that block JS
 *   - A visible "Returning to app…" message so the user knows what happened
 *   - Auto-close after 3 seconds in case the deep link doesn't fire
 */
function redirectToApp(res: Response, deepLinkUrl: string, pageTitle: string) {
  console.log(`[youtube-oauth] redirectToApp: ${deepLinkUrl}`);
  const escapedUrl = deepLinkUrl.replace(/'/g, "\\'").replace(/"/g, "&quot;");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${pageTitle}</title>
<meta http-equiv="refresh" content="0;url=${escapedUrl}">
<script>setTimeout(function(){window.location.href='${escapedUrl}';},100);</script>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0A0D14;color:#e2e8f0}
.box{text-align:center;padding:2rem}.spinner{width:32px;height:32px;border:3px solid #334155;border-top-color:#895af6;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 1rem}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="box"><div class="spinner"></div><p>${pageTitle}</p><p style="color:#94a3b8;font-size:0.85rem">If nothing happens, close this tab and return to the app.</p></div></body></html>`;
  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
}

export async function handleCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const stateRaw = req.query.state as string | undefined;
  const errorParam = req.query.error as string | undefined;
  let returnUrl = "/";
  try {
    if (!stateRaw) {
      console.log("[youtube-oauth] callback: missing state param");
      redirectToApp(res, "/?youtube_error=missing_state", "Connection failed");
      return;
    }
    const state = verifyState(stateRaw);
    if (!state) {
      console.log("[youtube-oauth] callback: invalid or expired state");
      redirectToApp(res, "/?youtube_error=invalid_state", "Connection failed");
      return;
    }
    returnUrl = state.returnUrl;
    console.log("[youtube-oauth] callback: valid state, returnUrl=" + returnUrl + " callbackUri=" + state.callbackUri);

    if (errorParam) {
      console.log("[youtube-oauth] callback: google returned error=" + errorParam);
      redirectToApp(res, `${returnUrl}?youtube_error=${encodeURIComponent(errorParam)}`, "Connection failed");
      return;
    }
    if (!code) {
      console.log("[youtube-oauth] callback: no authorization code");
      redirectToApp(res, `${returnUrl}?youtube_error=missing_code`, "Connection failed");
      return;
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.log("[youtube-oauth] callback: server misconfigured (missing credentials)");
      redirectToApp(res, `${returnUrl}?youtube_error=server_misconfigured`, "Connection failed");
      return;
    }

    // Token exchange
    console.log("[youtube-oauth] callback: exchanging authorization code for tokens...");
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: state.callbackUri, grant_type: "authorization_code" }).toString() });
    const tokens = (await tokenRes.json()) as Record<string, any>;
    if (!tokenRes.ok || tokens.error) {
      const detail = tokens.error_description ?? tokens.error ?? "unknown";
      console.log("[youtube-oauth] callback: token exchange FAILED:", detail);
      redirectToApp(res, `${returnUrl}?youtube_error=${encodeURIComponent("token_exchange_failed: " + detail)}`, "Connection failed");
      return;
    }
    console.log("[youtube-oauth] callback: token exchange OK, expires_in=" + tokens.expires_in + " has_refresh_token=" + !!tokens.refresh_token);

    const refreshToken = (tokens.refresh_token as string | undefined) ?? null;
    const expiresIn = (tokens.expires_in as number) ?? 3600;

    // Fetch YouTube channel info
    console.log("[youtube-oauth] callback: fetching YouTube channel info...");
    const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const ytData = (await ytRes.json()) as Record<string, any>;
    if (!ytRes.ok) {
      console.log("[youtube-oauth] callback: YouTube API error:", ytData?.error?.message ?? ytRes.status);
      redirectToApp(res, `${returnUrl}?youtube_error=${encodeURIComponent("youtube_api_error: " + (ytData?.error?.message ?? ytRes.status))}`, "Connection failed");
      return;
    }
    const item = ytData.items?.[0];
    if (!item) {
      console.log("[youtube-oauth] callback: no YouTube channel found for this Google account");
      redirectToApp(res, `${returnUrl}?youtube_error=no_channel`, "No channel found");
      return;
    }
    console.log("[youtube-oauth] callback: found channel id=" + item.id + " title=" + item.snippet?.title);

    // Save to database
    await User.findByIdAndUpdate(state.userId, { channelId: item.id, channelTitle: item.snippet?.title ?? null, channelThumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null, youtubeRefreshToken: refreshToken, youtubeTokenExpiry: new Date(Date.now() + expiresIn * 1000) });
    console.log("[youtube-oauth] callback: saved channel to database for userId=" + state.userId);

    // Build the deep link URL and redirect via HTML (not HTTP 302)
    const successUrl = new URL(returnUrl);
    successUrl.searchParams.set("youtube_success", "1");
    successUrl.searchParams.set("channel_title", item.snippet?.title ?? "");
    successUrl.searchParams.set("subscriber_count", String(item.statistics?.subscriberCount ?? "0"));
    console.log("[youtube-oauth] callback: SUCCESS — redirecting to " + successUrl.toString());
    redirectToApp(res, successUrl.toString(), "YouTube connected!");
  } catch (err) {
    console.error("[youtube-oauth] callback: unexpected error:", err);
    try {
      redirectToApp(res, `${returnUrl}?youtube_error=server_error`, "Connection failed");
    } catch { res.status(500).send("Internal error."); }
  }
}
