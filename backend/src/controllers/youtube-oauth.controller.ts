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
  return `${proto}://${host}/api/youtube-oauth/callback`;
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
    console.log("Google Redirect URI:", callbackUri);
    console.log("Generated OAuth URL:", url.toString());
    // Always return JSON. Mobile clients send Accept: application/json and
    // cannot follow 302 redirects with auth headers. Cloudflare/Render may
    // strip or rewrite the Accept header, so we no longer branch on it.
    res.json({ url: url.toString() });
  } catch (err) { next(err); }
}

export async function handleCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const stateRaw = req.query.state as string | undefined;
  const errorParam = req.query.error as string | undefined;
  let returnUrl = "/";
  try {
    if (!stateRaw) { res.redirect(`/?youtube_error=missing_state`); return; }
    const state = verifyState(stateRaw);
    if (!state) { res.redirect(`/?youtube_error=invalid_state`); return; }
    returnUrl = state.returnUrl;
    if (errorParam) { res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent(errorParam)}`); return; }
    if (!code) { res.redirect(`${returnUrl}?youtube_error=missing_code`); return; }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) { res.redirect(`${returnUrl}?youtube_error=server_misconfigured`); return; }
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: state.callbackUri, grant_type: "authorization_code" }).toString() });
    const tokens = (await tokenRes.json()) as Record<string, any>;
    if (!tokenRes.ok || tokens.error) { res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent("token_exchange_failed: " + (tokens.error_description ?? tokens.error ?? "unknown"))}`); return; }
    const refreshToken = (tokens.refresh_token as string | undefined) ?? null;
    const expiresIn = (tokens.expires_in as number) ?? 3600;
    const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const ytData = (await ytRes.json()) as Record<string, any>;
    if (!ytRes.ok) { res.redirect(`${returnUrl}?youtube_error=${encodeURIComponent("youtube_api_error: " + (ytData?.error?.message ?? ytRes.status))}`); return; }
    const item = ytData.items?.[0];
    if (!item) { res.redirect(`${returnUrl}?youtube_error=no_channel`); return; }
    await User.findByIdAndUpdate(state.userId, { channelId: item.id, channelTitle: item.snippet?.title ?? null, channelThumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null, youtubeRefreshToken: refreshToken, youtubeTokenExpiry: new Date(Date.now() + expiresIn * 1000) });
    const successUrl = new URL(returnUrl);
    successUrl.searchParams.set("youtube_success", "1");
    successUrl.searchParams.set("channel_title", item.snippet?.title ?? "");
    successUrl.searchParams.set("subscriber_count", String(item.statistics?.subscriberCount ?? "0"));
    res.redirect(successUrl.toString());
  } catch (err) {
    try { res.redirect(`${returnUrl}?youtube_error=server_error`); } catch { res.status(500).send("Internal error."); }
  }
}
