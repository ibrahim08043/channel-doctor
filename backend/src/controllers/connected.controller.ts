import type { Request, Response, NextFunction } from "express";
import { getUserId, ensureUser } from "../middleware/auth";
import { User, SavedAnalysis } from "@workspace/db";
import { getChannelRaw, getRecentVideos, searchChannels } from "../services/youtube.service";
import { deriveMetrics, healthScore } from "../services/analysis.service";
import { jsonCompletion, FAST_MODEL } from "../services/groq.service";
import { createNotification } from "../services/notification.service";

export async function debugOauth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { createClerkClient } = await import("@clerk/express");
    const clerkBackend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    let clerkUser: any = null; let clerkUserError: string | null = null;
    try { clerkUser = await clerkBackend.users.getUser(userId); } catch (e) { clerkUserError = e instanceof Error ? e.message : String(e); }
    let tokenResp: any = null; let tokenError: string | null = null;
    try { tokenResp = await clerkBackend.users.getUserOauthAccessToken(userId, "google"); } catch (e) { tokenError = e instanceof Error ? e.message : String(e); }
    const entries: Array<{ token: string; scopes?: string[]; tokenSecret?: string }> = (tokenResp?.data ?? []) as any;
    const accessToken = entries[0]?.token ?? null; const scopes = entries[0]?.scopes ?? [];
    let ytStatus: number | null = null; let ytBody: any = null;
    if (accessToken) { try { const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } }); ytStatus = ytRes.status; ytBody = await ytRes.json().catch(() => null); } catch (e) { ytBody = { error: String(e) }; } }
    let tokenInfo: any = null;
    if (accessToken) { try { const r = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`); tokenInfo = await r.json().catch(() => null); } catch {} }
    res.json({ userId, clerkUserError, tokenEntryCount: entries.length, tokenError, hasAccessToken: !!accessToken, accessTokenPreview: accessToken ? `${accessToken.slice(0, 6)}…${accessToken.slice(-6)}` : null, scopesFromClerk: scopes, hasYoutubeScope: scopes.some((s: string) => s.includes("youtube")), googleTokenInfo: tokenInfo, youtubeApiStatus: ytStatus, youtubeApiBody: ytBody });
  } catch (err) { next(err); }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    res.json({ id: user.id, email: user.email ?? null, name: user.name ?? null, avatar: user.avatar ?? null, channelId: user.channelId ?? null, channelTitle: user.channelTitle ?? null, channelThumbnail: user.channelThumbnail ?? null, plan: user.plan });
  } catch (err) { next(err); }
}

async function exchangeRefreshToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }).toString(),
    });
    const data = (await resp.json()) as Record<string, any>;
    if (!resp.ok || data.error) return null;
    return data.access_token as string;
  } catch { return null; }
}

export async function autoDetectYoutube(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    if (user.channelId) {
      res.json({ channelId: user.channelId, channelTitle: user.channelTitle ?? null, channelThumbnail: user.channelThumbnail ?? null });
      return;
    }
    if (user.youtubeRefreshToken) {
      const accessToken = await exchangeRefreshToken(user.youtubeRefreshToken);
      if (accessToken) {
        const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
        const ytData = (await ytRes.json()) as Record<string, any>;
        if (ytRes.ok && ytData.items?.[0]) {
          const item = ytData.items[0];
          const cid = item.id as string;
          const ctitle = (item.snippet?.title ?? null) as string | null;
          const cthumb = (item.snippet?.thumbnails?.default?.url ?? item.snippet?.thumbnails?.medium?.url ?? null) as string | null;
          await User.findByIdAndUpdate(userId, { channelId: cid, channelTitle: ctitle, channelThumbnail: cthumb });
          res.json({ channelId: cid, channelTitle: ctitle, channelThumbnail: cthumb });
          return;
        }
        await User.findByIdAndUpdate(userId, { youtubeRefreshToken: null, youtubeTokenExpiry: null });
      }
    }
    res.status(403).json({ error: "youtube_oauth_required", message: "Connect your YouTube channel to continue." });
  } catch (err) { next(err); }
}

export async function listSavedAnalyses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const rows = await SavedAnalysis.find({ userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ items: rows.map((r) => ({ id: r.id, channelId: r.channelId, channelTitle: r.channelTitle, channelThumbnail: r.channelThumbnail, healthScore: r.healthScore, diagnosis: r.diagnosis, createdAt: r.createdAt.toISOString() })) });
  } catch (err) { next(err); }
}

export async function createSavedAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const { channelId } = req.body || {};
    if (!channelId) { res.status(400).json({ error: "channelId required" }); return; }
    const channel = await getChannelRaw(String(channelId));
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    const ai = await jsonCompletion<{ diagnosis: string }>(
      "You are an elite YouTube growth strategist. Return strict JSON.",
      `Give a 2-3 sentence brutally honest diagnosis of this channel.\nTitle: ${channel.title}\nSubs: ${channel.subscriberCount}\nAvg views: ${Math.round(metrics.avgViews)}\nGrowth ratio: ${metrics.growthRatio.toFixed(2)}\nHealth score: ${health.score}\nReturn JSON: { diagnosis: string }`,
      { model: FAST_MODEL, temperature: 0.6 }
    );
    const r = await SavedAnalysis.create({ userId, channelId: channel.id, channelTitle: channel.title, channelThumbnail: channel.thumbnail, healthScore: health.score, diagnosis: ai.diagnosis, payload: { metrics, health } });

    // Real-time "analysis completed" notification (respects user's notification prefs).
    await createNotification(userId, {
      type: "analysis_completed",
      title: "Analysis saved",
      body: `${channel.title} scored ${health.score}/100 — diagnosis saved to your library.`,
      severity: health.score >= 60 ? "info" : "warning",
      data: { channelId: channel.id, healthScore: health.score },
    }).catch(() => {});

    res.json({ id: r.id, channelId: r.channelId, channelTitle: r.channelTitle, channelThumbnail: r.channelThumbnail, healthScore: r.healthScore, diagnosis: r.diagnosis, createdAt: r.createdAt.toISOString() });
  } catch (err) { next(err); }
}

export async function lookupChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const input = ((req.body as any)?.input ?? "").trim() as string;
    if (!input) { res.status(400).json({ error: "input_required", message: "Enter a channel URL, @handle, or channel ID." }); return; }
    if (!process.env.YOUTUBE_API_KEY) { res.status(503).json({ error: "api_key_missing", message: "Channel lookup not available." }); return; }
    const fromUrl = input.match(/channel\/(UC[\w-]{20,25})/i)?.[1] ?? null;
    if (fromUrl) { const ch = await getChannelRaw(fromUrl); if (ch) { res.json({ channelId: ch.id, channelTitle: ch.title, channelThumbnail: ch.thumbnail }); return; } }
    if (/^UC[\w-]{20,25}$/.test(input)) { const ch = await getChannelRaw(input); if (ch) { res.json({ channelId: ch.id, channelTitle: ch.title, channelThumbnail: ch.thumbnail }); return; } }
    const results = await searchChannels(input);
    if (!results.length) { res.status(404).json({ error: "channel_not_found", message: "No channel found." }); return; }
    res.json({ channelId: results[0].id, channelTitle: results[0].title, channelThumbnail: results[0].thumbnail });
  } catch (err) { next(err); }
}

export async function linkChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const { channelId, channelTitle, channelThumbnail } = (req.body ?? {}) as Record<string, any>;
    if (!channelId || typeof channelId !== "string") { res.status(400).json({ error: "channelId_required", message: "channelId is required." }); return; }
    await User.findByIdAndUpdate(userId, { channelId, channelTitle: channelTitle ?? null, channelThumbnail: channelThumbnail ?? null });
    const user = await User.findById(userId);
    res.json({ id: user!.id, email: user!.email ?? null, name: user!.name ?? null, avatar: user!.avatar ?? null, channelId: user!.channelId ?? null, channelTitle: user!.channelTitle ?? null, channelThumbnail: user!.channelThumbnail ?? null, plan: user!.plan });
  } catch (err) { next(err); }
}

export async function disconnectChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    await User.findByIdAndUpdate(userId, { channelId: null, channelTitle: null, channelThumbnail: null });
    const user = await User.findById(userId);
    res.json({ id: user!.id, email: user!.email ?? null, name: user!.name ?? null, avatar: user!.avatar ?? null, channelId: user!.channelId ?? null, channelTitle: user!.channelTitle ?? null, channelThumbnail: user!.channelThumbnail ?? null, plan: user!.plan });
  } catch (err) { next(err); }
}

export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    if (!user.channelId) { res.json({ alerts: [] }); return; }
    const channel = await getChannelRaw(user.channelId);
    if (!channel) { res.json({ alerts: [] }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const alerts: { id: string; severity: "info" | "warning" | "critical"; title: string; description: string; action: string }[] = [];
    if (metrics.uploadCadencePerWeek < 0.5) alerts.push({ id: "low-cadence", severity: "critical", title: "Posting frequency dropped", description: `Averaging ${metrics.uploadCadencePerWeek.toFixed(2)}/week.`, action: "Plan 1 upload this week." });
    else if (metrics.uploadCadencePerWeek < 1) alerts.push({ id: "cadence-warning", severity: "warning", title: "Cadence below threshold", description: `${metrics.uploadCadencePerWeek.toFixed(2)}/week. Aim for 1+.`, action: "Schedule an extra video." });
    const r3 = videos.slice(0, 3);
    if (r3.length === 3) { const ra = r3.reduce((s, v) => s + v.views, 0) / 3; if (ra < metrics.avgViews * 0.6) alerts.push({ id: "underperforming-streak", severity: "warning", title: "Last 3 underperformed", description: `Avg ${Math.round(ra)} vs ${Math.round(metrics.avgViews)}.`, action: "Review titles & thumbnails." }); }
    if (metrics.growthRatio < 0.7 && videos.length >= 8) alerts.push({ id: "growth-trending-down", severity: "critical", title: "Views trending down", description: `Ratio ${metrics.growthRatio.toFixed(2)}x.`, action: "Run 'Why Failed'." });
    if (metrics.engagementRate < 0.01 && videos.length > 0) alerts.push({ id: "low-engagement", severity: "warning", title: "Low engagement", description: `${(metrics.engagementRate * 100).toFixed(2)}%.`, action: "Add CTAs." });
    if (alerts.length === 0) alerts.push({ id: "all-clear", severity: "info", title: "All healthy", description: "Everything looks stable.", action: "Run a fresh analysis." });
    res.json({ alerts });
  } catch (err) { next(err); }
}

export async function deleteSavedAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await SavedAnalysis.findOneAndDelete({ _id: req.params.id as string, userId });
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    const sc = await SavedAnalysis.countDocuments({ userId });
    const daysSince = Math.floor((Date.now() - new Date((user.createdAt ?? new Date()).toISOString()).getTime()) / 86400000);
    res.json({
      analysesRun: sc, savedReports: sc, channelConnected: !!user.channelId, joinedAt: (user.createdAt ?? new Date()).toISOString(),
      achievements: [
        { id: "first-analysis", name: "First Diagnosis", description: "Saved your first analysis", unlocked: sc >= 1, icon: "stethoscope" },
        { id: "channel-connected", name: "Connected Creator", description: "Linked your YouTube channel", unlocked: !!user.channelId, icon: "youtube" },
        { id: "five-reports", name: "Power User", description: "Saved 5 reports", unlocked: sc >= 5, icon: "trophy" },
        { id: "ten-reports", name: "Analyst", description: "Saved 10 reports", unlocked: sc >= 10, icon: "award" },
        { id: "week-strong", name: "Week One", description: "Stuck around for 7 days", unlocked: daysSince >= 7, icon: "calendar" },
      ],
    });
  } catch (err) { next(err); }
}
