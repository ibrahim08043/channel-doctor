import type { Request, Response, NextFunction } from "express";
import { searchChannels, getChannelRaw, getRecentVideos, searchSimilarChannels, getVideo } from "../services/youtube.service";
import { deriveMetrics, healthScore, viewTrend, uploadCadenceSeries } from "../services/analysis.service";
import { jsonCompletion, structuredCompletion, FAST_MODEL } from "../services/groq.service";
import { cached } from "../services/cache.service";

function round(n: number, places: number): number { const f = Math.pow(10, places); return Math.round(n * f) / f; }
const OPT = { model: FAST_MODEL };

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) { res.status(400).json({ error: "q required" }); return; }
    res.json({ results: await searchChannels(q) });
  } catch (err) { next(err); }
}

export async function getChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    res.json({
      id: channel.id, title: channel.title, description: channel.description, thumbnail: channel.thumbnail,
      bannerUrl: channel.bannerUrl ?? null, country: channel.country ?? null, publishedAt: channel.publishedAt,
      subscriberCount: channel.subscriberCount, hiddenSubscriberCount: channel.hiddenSubscriberCount,
      viewCount: channel.viewCount, videoCount: channel.videoCount,
      avgViews: Math.round(metrics.avgViews), medianViews: Math.round(metrics.medianViews),
      uploadCadencePerWeek: round(metrics.uploadCadencePerWeek, 2), engagementRate: round(metrics.engagementRate, 4),
      growthRatio: round(metrics.growthRatio, 3), viewsPerSubRatio: round(metrics.viewsPerSubRatio, 3),
      bestPostingHour: { dayOfWeek: metrics.bestPostingDow, hour: metrics.bestPostingHour },
      healthScore: health.score, healthStatus: health.status, healthBreakdown: health.breakdown,
      recentVideos: videos.slice(0, 12).map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail, publishedAt: v.publishedAt, durationSeconds: v.durationSeconds, views: v.views, likes: v.likes, comments: v.comments })),
      viewTrend: viewTrend(videos), uploadCadence: uploadCadenceSeries(videos),
    });
  } catch (err) { next(err); }
}

export async function getAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
    const bottomVideos = [...videos].sort((a, b) => a.views - b.views).slice(0, 5);
    const ai = await jsonCompletion<{ diagnosis: string; strengths: string[]; weaknesses: string[]; opportunities: string[]; nextActions: { priority: "high" | "medium" | "low"; action: string; impact: string }[]; contentNiche: string; audienceInsight: string }>(
      "You are an elite YouTube growth strategist. Return strict JSON.",
      `Analyze this channel and return JSON with diagnosis, strengths, weaknesses, opportunities, nextActions, contentNiche, audienceInsight.\nChannel: ${channel.title}\nSubs: ${channel.subscriberCount}\nAvg views: ${Math.round(metrics.avgViews)}\nEngagement: ${(metrics.engagementRate * 100).toFixed(2)}%\nHealth: ${health.score}/100`,
      { ...OPT, temperature: 0.6 });
    res.json({ channelId: channel.id, healthScore: health.score, healthStatus: health.status, ...ai });
  } catch (err) { next(err); }
}

export async function getVideoBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 12);
    if (videos.length === 0) { res.json({ items: [] }); return; }
    const metrics = deriveMetrics(channel, videos);
    const items = await cached(`videoBreakdown:${channel.id}`, 60 * 30, async () => {
      const ai = await jsonCompletion<{ items: { videoId: string; titleScore: number; thumbnailCritique: string; hookStrength: "weak" | "ok" | "strong"; ctrCategory: "low" | "average" | "high" | "viral"; verdict: string }[] }>(
        "You are a YouTube expert. For each video score title (0-100), critique thumbnail, predict hook strength, estimate CTR category, give verdict. Return strict JSON.",
        `Channel avg views: ${Math.round(metrics.avgViews)}.\nVideos: ${JSON.stringify(videos.slice(0, 8).map((v) => ({ videoId: v.id, title: v.title, views: v.views, likes: v.likes, comments: v.comments, durationSec: v.durationSeconds })))}\nReturn JSON: { items: [{videoId, titleScore, thumbnailCritique, hookStrength, ctrCategory, verdict}...] }`,
        { ...OPT, temperature: 0.4 });
      return ai.items.map((it) => { const v = videos.find((x) => x.id === it.videoId); return { ...it, title: v?.title ?? "", thumbnail: v?.thumbnail ?? "", views: v?.views ?? 0, publishedAt: v?.publishedAt ?? "" }; });
    });
    res.json({ items });
  } catch (err) { next(err); }
}

export async function getCompetitors(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const niche = String(req.query.niche || channel.title);
    const candidates = await searchSimilarChannels(channel.title, niche, 4);
    const filtered = candidates.filter((c) => c.id && c.id !== channel.id).slice(0, 4);
    const competitors = (await Promise.all(filtered.map(async (c) => {
      try { const raw = await getChannelRaw(c.id); if (!raw) return null; const v = await getRecentVideos(raw.uploadsPlaylistId, 15); const m = deriveMetrics(raw, v); return { id: raw.id, title: raw.title, thumbnail: raw.thumbnail, subscriberCount: raw.subscriberCount, viewCount: raw.viewCount, videoCount: raw.videoCount, avgViews: Math.round(m.avgViews), uploadsPerWeek: round(m.uploadCadencePerWeek, 2), engagementRate: round(m.engagementRate, 4) }; } catch { return null; }
    }))).filter((x): x is NonNullable<typeof x> => !!x);
    if (competitors.length === 0) { res.json({ competitors: [], comparison: "No comparable channels found.", advantages: [], gaps: [] }); return; }
    const myVids = await getRecentVideos(channel.uploadsPlaylistId, 15);
    const myMetrics = deriveMetrics(channel, myVids);
    const ai = await structuredCompletion<{
      comparison: string; advantages: string[]; gaps: string[];
    }>("competitor_comparison", {
      type: "object",
      additionalProperties: false,
      required: ["comparison", "advantages", "gaps"],
      properties: {
        comparison: { type: "string" },
        advantages: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
      },
    },
      "You are a YouTube competitive analyst. Return only valid JSON.",
      `Compare my channel vs competitors.\nMine: ${JSON.stringify({ title: channel.title, subs: channel.subscriberCount, avgViews: Math.round(myMetrics.avgViews) })}\nCompetitors: ${JSON.stringify(competitors)}\nReturn JSON: { comparison: string, advantages: string[], gaps: string[] }`,
      { model: FAST_MODEL, temperature: 0.5 });
    const comparison =
      typeof ai.comparison === "string" ? ai.comparison
      : ai.comparison && typeof ai.comparison === "object"
        ? JSON.stringify(ai.comparison)
        : "Comparison unavailable.";
    res.json({
      competitors,
      comparison,
      advantages: Array.isArray(ai.advantages) ? ai.advantages : [],
      gaps: Array.isArray(ai.gaps) ? ai.gaps : [],
    });
  } catch (err) { next(err); }
}

export async function getContentPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 15);
    const metrics = deriveMetrics(channel, videos);
    const result = await cached(`content-plan:${channel.id}`, 30 * 60000, () =>
      jsonCompletion<{ cadenceAdvice: string; schedule: { day: string; topic: string; format: string; hook: string; why: string }[] }>(
        "You are a YouTube content strategist. Return strict JSON.",
        `Build a 7-day content plan.\nChannel: ${channel.title}\nSubs: ${channel.subscriberCount}\nCadence: ${metrics.uploadCadencePerWeek.toFixed(2)}/week\nReturn JSON: { cadenceAdvice: string, schedule: [{day, topic, format, hook, why}...] }`,
        { ...OPT, temperature: 0.85 }));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await getChannelRaw(req.params.channelId as string);
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    const result = await cached(`forecast:${channel.id}`, 30 * 60000, () =>
      jsonCompletion<{ projectedSubs30d: number; projectedViews30d: number; confidence: "low" | "medium" | "high"; summary: string; drivers: string[]; risks: string[] }>(
        "You are a YouTube growth forecaster. Be realistic.",
        `Forecast 30 days for ${channel.title}.\nSubs: ${channel.subscriberCount}\nAvg views: ${Math.round(metrics.avgViews)}\nCadence: ${metrics.uploadCadencePerWeek.toFixed(2)}/week\nHealth: ${health.score}/100\nReturn JSON: { projectedSubs30d, projectedViews30d, confidence, summary, drivers: string[], risks: string[] }`,
        { ...OPT, temperature: 0.5 }));
    res.json(result);
  } catch (err) { next(err); }
}