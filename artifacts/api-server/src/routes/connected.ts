import { Router, type IRouter } from "express";
import { requireAuth, ensureUser, getUserId } from "../middlewares/auth";
import { db, usersTable, savedAnalysesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getChannelRaw, getRecentVideos } from "../services/youtube";
import { deriveMetrics, healthScore } from "../services/analysis";
import { jsonCompletion } from "../services/openaiClient";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/connected/me", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    res.json({
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      avatar: user.avatar ?? null,
      channelId: user.channelId ?? null,
      channelTitle: user.channelTitle ?? null,
      channelThumbnail: user.channelThumbnail ?? null,
      plan: user.plan,
    });
  } catch (err) {
    next(err);
  }
});

// ── DEBUG: returns raw token state + YouTube API response ──────────────────
router.get("/connected/debug-oauth", async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { createClerkClient } = await import("@clerk/express");
    const clerkBackend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    // 1. Full Clerk user record
    let clerkUser: any = null;
    let clerkUserError: string | null = null;
    try {
      clerkUser = await clerkBackend.users.getUser(userId);
    } catch (e) {
      clerkUserError = e instanceof Error ? e.message : String(e);
    }

    // 2. OAuth token retrieval
    let tokenResp: any = null;
    let tokenError: string | null = null;
    try {
      tokenResp = await clerkBackend.users.getUserOauthAccessToken(userId, "google");
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e);
    }

    const entries: Array<{ token: string; scopes?: string[]; tokenSecret?: string }> =
      (tokenResp?.data ?? []) as any;
    const firstEntry = entries[0] ?? null;
    const accessToken = firstEntry?.token ?? null;
    const scopes = firstEntry?.scopes ?? [];

    // 3. Raw YouTube API call if we have a token
    let ytStatus: number | null = null;
    let ytBody: any = null;
    if (accessToken) {
      try {
        const ytRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        ytStatus = ytRes.status;
        ytBody = await ytRes.json().catch(() => null);
      } catch (e) {
        ytBody = { fetchError: e instanceof Error ? e.message : String(e) };
      }
    }

    // 4. Token info from Google tokeninfo endpoint
    let tokenInfo: any = null;
    if (accessToken) {
      try {
        const tiRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
        );
        tokenInfo = await tiRes.json().catch(() => null);
      } catch {
        tokenInfo = null;
      }
    }

    res.json({
      userId,
      clerkUserError,
      externalAccounts: clerkUser?.externalAccounts?.map((a: any) => ({
        provider: a.provider,
        emailAddress: a.emailAddress,
        approvedScopes: a.approvedScopes,
        publicMetadata: a.publicMetadata,
      })) ?? null,
      tokenEntryCount: entries.length,
      tokenError,
      hasAccessToken: !!accessToken,
      // Only show first/last 6 chars so we can confirm it exists without exposing it
      accessTokenPreview: accessToken ? `${accessToken.slice(0, 6)}…${accessToken.slice(-6)}` : null,
      scopesFromClerk: scopes,
      hasYoutubeScope: scopes.some((s: string) => s.includes("youtube")),
      // Google's own tokeninfo endpoint — tells us the real granted scopes
      googleTokenInfo: tokenInfo,
      youtubeApiStatus: ytStatus,
      youtubeApiBody: ytBody,
    });
  } catch (err) {
    next(err);
  }
});

// Helper: use a stored YouTube refresh token to obtain a fresh access token
async function getFreshYouTubeToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }).toString(),
    });
    const data = (await resp.json()) as Record<string, any>;
    if (!resp.ok || data.error) {
      console.error("[auto-detect] refresh_token exchange failed:", data.error, data.error_description);
      return null;
    }
    return data.access_token as string;
  } catch (e) {
    console.error("[auto-detect] refresh_token fetch threw:", e);
    return null;
  }
}

router.post("/connected/auto-detect-youtube", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);

    // ── Log exact DB state before any logic runs ──────────────────────────────
    console.log("[auto-detect] ── START ── userId:", userId);
    console.log("[auto-detect]   DB.channelId          :", user.channelId ?? "null");
    console.log("[auto-detect]   DB.youtubeRefreshToken:", user.youtubeRefreshToken ? "PRESENT" : "null");
    console.log("[auto-detect]   DB.youtubeTokenExpiry :", user.youtubeTokenExpiry ?? "null");
    console.log("[auto-detect]   DB.channelTitle       :", user.channelTitle ?? "null");

    // ── PATH 0: Channel already stored — return immediately ──────────────────
    if (user.channelId) {
      console.log("[auto-detect] PATH 0 → channelId already in DB, returning directly");
      res.json({
        channelId: user.channelId,
        channelTitle: user.channelTitle ?? null,
        channelThumbnail: user.channelThumbnail ?? null,
      });
      return;
    }

    // ── PATH 1: Exchange stored YouTube refresh token for a fresh access token ─
    if (user.youtubeRefreshToken) {
      console.log("[auto-detect] PATH 1 → youtubeRefreshToken present, exchanging...");
      const accessToken = await getFreshYouTubeToken(user.youtubeRefreshToken);
      if (accessToken) {
        console.log("[auto-detect] PATH 1 → token exchange succeeded, calling YouTube API...");
        const ytRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const ytData = (await ytRes.json()) as Record<string, any>;
        console.log("[auto-detect] PATH 1 → YouTube API status:", ytRes.status);
        if (ytRes.ok && ytData.items?.[0]) {
          const item = ytData.items[0];
          const channelId = item.id as string;
          const channelTitle = (item.snippet?.title ?? null) as string | null;
          const channelThumbnail = (
            item.snippet?.thumbnails?.default?.url ??
            item.snippet?.thumbnails?.medium?.url ?? null
          ) as string | null;
          console.log("[auto-detect] PATH 1 → channel found:", channelId, channelTitle);
          await db.update(usersTable)
            .set({ channelId, channelTitle, channelThumbnail, updatedAt: new Date() })
            .where(eq(usersTable.id, userId));
          res.json({ channelId, channelTitle, channelThumbnail });
          return;
        }
        // Refresh token is stale — clear it
        console.warn("[auto-detect] PATH 1 → YouTube API failed or no channel; clearing stale token");
        await db.update(usersTable)
          .set({ youtubeRefreshToken: null, youtubeTokenExpiry: null, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
      } else {
        console.warn("[auto-detect] PATH 1 → token exchange failed");
      }
    } else {
      console.log("[auto-detect] PATH 1 → skipped (no youtubeRefreshToken in DB)");
    }

    // ── No token available — user must complete YouTube OAuth flow ────────────
    console.log("[auto-detect] → youtube_oauth_required (callback has never completed for this user)");
    res.status(403).json({
      error: "youtube_oauth_required",
      message: "Connect your YouTube channel to continue.",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/connected/saved-analyses", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const rows = await db
      .select()
      .from(savedAnalysesTable)
      .where(eq(savedAnalysesTable.userId, userId))
      .orderBy(desc(savedAnalysesTable.createdAt))
      .limit(50);
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        channelTitle: r.channelTitle,
        channelThumbnail: r.channelThumbnail,
        healthScore: r.healthScore,
        diagnosis: r.diagnosis,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/connected/saved-analyses", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const { channelId } = req.body || {};
    if (!channelId) {
      res.status(400).json({ error: "channelId required" });
      return;
    }
    const channel = await getChannelRaw(String(channelId));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);

    const ai = await jsonCompletion<{ diagnosis: string }>(
      "You are an elite YouTube growth strategist. Return strict JSON.",
      `Give a 2-3 sentence brutally honest diagnosis of this channel.
Title: ${channel.title}
Subs: ${channel.subscriberCount}
Avg views: ${Math.round(metrics.avgViews)}
Engagement rate: ${(metrics.engagementRate * 100).toFixed(2)}%
Growth ratio: ${metrics.growthRatio.toFixed(2)}
Health score: ${health.score}

Return JSON: { diagnosis: string }`,
      { temperature: 0.6 }
    );

    const inserted = await db
      .insert(savedAnalysesTable)
      .values({
        userId,
        channelId: channel.id,
        channelTitle: channel.title,
        channelThumbnail: channel.thumbnail,
        healthScore: health.score,
        diagnosis: ai.diagnosis,
        payload: { metrics, health },
      })
      .returning();

    const r = inserted[0];
    res.json({
      id: r.id,
      channelId: r.channelId,
      channelTitle: r.channelTitle,
      channelThumbnail: r.channelThumbnail,
      healthScore: r.healthScore,
      diagnosis: r.diagnosis,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/connected/lookup-channel", async (req, res, next) => {
  try {
    const input = ((req.body as any)?.input ?? "").trim() as string;
    if (!input) {
      res.status(400).json({ error: "input_required", message: "Please enter a channel URL, @handle, or channel ID." });
      return;
    }

    // Check API key first
    if (!process.env.YOUTUBE_API_KEY) {
      res.status(503).json({
        error: "api_key_missing",
        message: "Channel lookup is not available right now (YouTube API key not configured). Please try again later.",
      });
      return;
    }

    // Extract channel ID directly from URL patterns like /channel/UCxxxx
    const channelIdFromUrl = input.match(/channel\/(UC[\w-]{20,25})/i)?.[1] ?? null;
    if (channelIdFromUrl) {
      const channel = await getChannelRaw(channelIdFromUrl);
      if (!channel) {
        res.status(404).json({ error: "channel_not_found", message: "No channel found with that URL. Double-check and try again." });
        return;
      }
      res.json({ channelId: channel.id, channelTitle: channel.title, channelThumbnail: channel.thumbnail });
      return;
    }

    // Direct channel ID format (UC + ~22 chars)
    if (/^UC[\w-]{20,25}$/.test(input)) {
      const channel = await getChannelRaw(input);
      if (!channel) {
        res.status(404).json({ error: "channel_not_found", message: "No channel found with that ID. Double-check and try again." });
        return;
      }
      res.json({ channelId: channel.id, channelTitle: channel.title, channelThumbnail: channel.thumbnail });
      return;
    }

    // Handle or search (covers @handle, youtube.com/@handle, names)
    const { searchChannels } = await import("../services/youtube");
    const results = await searchChannels(input);
    if (!results.length) {
      res.status(404).json({ error: "channel_not_found", message: "No channel found. Try the full channel URL or @handle." });
      return;
    }
    const first = results[0];
    res.json({ channelId: first.id, channelTitle: first.title, channelThumbnail: first.thumbnail });
  } catch (err) {
    next(err);
  }
});

router.post("/connected/link-channel", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const { channelId, channelTitle, channelThumbnail } = (req.body ?? {}) as Record<string, any>;
    if (!channelId || typeof channelId !== "string") {
      res.status(400).json({ error: "channelId_required", message: "channelId is required." });
      return;
    }
    await db
      .update(usersTable)
      .set({ channelId, channelTitle: channelTitle ?? null, channelThumbnail: channelThumbnail ?? null, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    res.json({
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      avatar: user.avatar ?? null,
      channelId: user.channelId ?? null,
      channelTitle: user.channelTitle ?? null,
      channelThumbnail: user.channelThumbnail ?? null,
      plan: user.plan,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/connected/connect", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    await db
      .update(usersTable)
      .set({
        channelId: null,
        channelTitle: null,
        channelThumbnail: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    res.json({
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      avatar: user.avatar ?? null,
      channelId: user.channelId ?? null,
      channelTitle: user.channelTitle ?? null,
      channelThumbnail: user.channelThumbnail ?? null,
      plan: user.plan,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/connected/alerts", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    if (!user.channelId) {
      res.json({ alerts: [] });
      return;
    }
    const channel = await getChannelRaw(user.channelId);
    if (!channel) {
      res.json({ alerts: [] });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const alerts: { id: string; severity: "info" | "warning" | "critical"; title: string; description: string; action: string }[] = [];

    if (metrics.uploadCadencePerWeek < 0.5) {
      alerts.push({
        id: "low-cadence",
        severity: "critical",
        title: "Posting frequency dropped sharply",
        description: `You're averaging ${metrics.uploadCadencePerWeek.toFixed(2)} uploads/week. The algorithm rewards consistency.`,
        action: "Plan at least 1 upload this week.",
      });
    } else if (metrics.uploadCadencePerWeek < 1) {
      alerts.push({
        id: "cadence-warning",
        severity: "warning",
        title: "Cadence is below the consistency threshold",
        description: `Currently ${metrics.uploadCadencePerWeek.toFixed(2)} uploads/week. Aim for 1+ per week.`,
        action: "Schedule one extra video this week.",
      });
    }

    const recent3 = videos.slice(0, 3);
    if (recent3.length === 3) {
      const recentAvg = recent3.reduce((s, v) => s + v.views, 0) / 3;
      if (recentAvg < metrics.avgViews * 0.6) {
        alerts.push({
          id: "underperforming-streak",
          severity: "warning",
          title: "Your last 3 videos underperformed",
          description: `Recent avg ${Math.round(recentAvg)} vs channel avg ${Math.round(metrics.avgViews)}.`,
          action: "Review titles & thumbnails — try the AI optimizer.",
        });
      }
    }

    if (metrics.growthRatio < 0.7 && videos.length >= 8) {
      alerts.push({
        id: "growth-trending-down",
        severity: "critical",
        title: "Views trending down",
        description: `Recent growth ratio is ${metrics.growthRatio.toFixed(2)}x — you're losing momentum.`,
        action: "Diagnose your most recent flop with 'Why Failed'.",
      });
    }

    if (metrics.engagementRate < 0.01 && videos.length > 0) {
      alerts.push({
        id: "low-engagement",
        severity: "warning",
        title: "Engagement is very low",
        description: `Engagement rate ${(metrics.engagementRate * 100).toFixed(2)}%. Healthy is 2-5%+.`,
        action: "Add stronger CTAs and pinned comments.",
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: "all-clear",
        severity: "info",
        title: "All systems healthy",
        description: "Cadence, engagement, and growth all look stable. Keep shipping.",
        action: "Run a fresh analysis to find new opportunities.",
      });
    }

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

router.delete("/connected/saved-analyses/:id", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    await db
      .delete(savedAnalysesTable)
      .where(and(eq(savedAnalysesTable.id, req.params.id), eq(savedAnalysesTable.userId, userId)));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/connected/stats", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);
    const saved = await db
      .select()
      .from(savedAnalysesTable)
      .where(eq(savedAnalysesTable.userId, userId));
    const savedCount = saved.length;
    const channelConnected = !!user.channelId;
    const joinedAt = (user.createdAt ?? new Date()).toISOString();
    const daysSince = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86_400_000);

    const achievements = [
      {
        id: "first-analysis",
        name: "First Diagnosis",
        description: "Saved your first channel analysis",
        unlocked: savedCount >= 1,
        icon: "stethoscope",
      },
      {
        id: "channel-connected",
        name: "Connected Creator",
        description: "Linked your YouTube channel",
        unlocked: channelConnected,
        icon: "youtube",
      },
      {
        id: "five-reports",
        name: "Power User",
        description: "Saved 5 channel reports",
        unlocked: savedCount >= 5,
        icon: "trophy",
      },
      {
        id: "ten-reports",
        name: "Analyst",
        description: "Saved 10 channel reports",
        unlocked: savedCount >= 10,
        icon: "award",
      },
      {
        id: "week-strong",
        name: "Week One",
        description: "Stuck around for 7 days",
        unlocked: daysSince >= 7,
        icon: "calendar",
      },
    ];

    res.json({
      analysesRun: savedCount,
      savedReports: savedCount,
      channelConnected,
      joinedAt,
      achievements,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
