import { Router, type IRouter } from "express";
import { searchChannels, getChannelRaw, getRecentVideos, searchSimilarChannels } from "../../services/youtube";
import { deriveMetrics, healthScore, viewTrend, uploadCadenceSeries } from "../../services/analysis";
import { jsonCompletion } from "../../services/openaiClient";
import { cached } from "../../services/cache";

const router: IRouter = Router();

router.get("/channels/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ error: "q required" });
      return;
    }
    const results = await searchChannels(q);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

router.get("/channels/:channelId", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);

    res.json({
      id: channel.id,
      title: channel.title,
      description: channel.description,
      thumbnail: channel.thumbnail,
      bannerUrl: channel.bannerUrl ?? null,
      country: channel.country ?? null,
      publishedAt: channel.publishedAt,
      subscriberCount: channel.subscriberCount,
      hiddenSubscriberCount: channel.hiddenSubscriberCount,
      viewCount: channel.viewCount,
      videoCount: channel.videoCount,
      avgViews: Math.round(metrics.avgViews),
      medianViews: Math.round(metrics.medianViews),
      uploadCadencePerWeek: round(metrics.uploadCadencePerWeek, 2),
      engagementRate: round(metrics.engagementRate, 4),
      growthRatio: round(metrics.growthRatio, 3),
      viewsPerSubRatio: round(metrics.viewsPerSubRatio, 3),
      bestPostingHour: { dayOfWeek: metrics.bestPostingDow, hour: metrics.bestPostingHour },
      healthScore: health.score,
      healthStatus: health.status,
      healthBreakdown: health.breakdown,
      recentVideos: videos.slice(0, 12).map((v) => ({
        id: v.id,
        title: v.title,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt,
        durationSeconds: v.durationSeconds,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
      })),
      viewTrend: viewTrend(videos),
      uploadCadence: uploadCadenceSeries(videos),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/channels/:channelId/analysis", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);

    const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
    const bottomVideos = [...videos].sort((a, b) => a.views - b.views).slice(0, 5);

    const aiContext = {
      channel: {
        title: channel.title,
        subscribers: channel.subscriberCount,
        totalViews: channel.viewCount,
        videos: channel.videoCount,
        about: channel.description.slice(0, 500),
      },
      metrics: {
        avgViews: Math.round(metrics.avgViews),
        medianViews: Math.round(metrics.medianViews),
        engagementRate: round(metrics.engagementRate, 4),
        viewsPerSubRatio: round(metrics.viewsPerSubRatio, 3),
        growthRatio: round(metrics.growthRatio, 3),
        uploadsPerWeek: round(metrics.uploadCadencePerWeek, 2),
        consistency: round(metrics.consistencyScore, 2),
      },
      healthScore: health.score,
      healthStatus: health.status,
      topVideos: topVideos.map((v) => ({ title: v.title, views: v.views, likes: v.likes })),
      bottomVideos: bottomVideos.map((v) => ({ title: v.title, views: v.views, likes: v.likes })),
    };

    const ai = await jsonCompletion<{
      diagnosis: string;
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      nextActions: { priority: "high" | "medium" | "low"; action: string; impact: string }[];
      contentNiche: string;
      audienceInsight: string;
    }>(
      "You are an elite YouTube growth strategist. Analyze the channel and return strict JSON.",
      `Analyze this YouTube channel and return a JSON object with keys:
diagnosis (2-3 sentence brutally honest overall diagnosis),
strengths (string[] up to 4),
weaknesses (string[] up to 4),
opportunities (string[] up to 4),
nextActions (array of {priority: 'high'|'medium'|'low', action, impact}, 5 items),
contentNiche (one short phrase),
audienceInsight (1-2 sentences).

Channel data:
${JSON.stringify(aiContext)}`,
      { temperature: 0.6 }
    );

    res.json({
      channelId: channel.id,
      healthScore: health.score,
      healthStatus: health.status,
      ...ai,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/channels/:channelId/video-breakdown", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 12);
    if (videos.length === 0) {
      res.json({ items: [] });
      return;
    }
    const metrics = deriveMetrics(channel, videos);
    const items = await cached(
      `videoBreakdown:${channel.id}`,
      60 * 30,
      async () => {
        const ai = await jsonCompletion<{
          items: {
            videoId: string;
            titleScore: number;
            thumbnailCritique: string;
            hookStrength: "weak" | "ok" | "strong";
            ctrCategory: "low" | "average" | "high" | "viral";
            verdict: string;
          }[];
        }>(
          "You are a YouTube expert. For each video, score the title (0-100), critique the implied thumbnail strategy in one sentence, predict hook strength (weak|ok|strong), estimate CTR category (low|average|high|viral) based on title + view performance vs channel average, and give a 1-sentence verdict. Return strict JSON.",
          `Channel avg views: ${Math.round(metrics.avgViews)}.
Videos:
${JSON.stringify(
  videos.slice(0, 8).map((v) => ({
    videoId: v.id,
    title: v.title,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    durationSec: v.durationSeconds,
  })),
)}

Return JSON: { items: [...] }`,
          { temperature: 0.4 },
        );
        return ai.items.map((it) => {
          const v = videos.find((x) => x.id === it.videoId);
          return {
            ...it,
            title: v?.title ?? "",
            thumbnail: v?.thumbnail ?? "",
            views: v?.views ?? 0,
            publishedAt: v?.publishedAt ?? "",
          };
        });
      },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get("/channels/:channelId/competitors", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const niche = String(req.query.niche || channel.title);
    const candidates = await searchSimilarChannels(channel.title, niche, 4);
    const filtered = candidates.filter((c) => c.id && c.id !== channel.id).slice(0, 4);

    const competitors = await Promise.all(
      filtered.map(async (c) => {
        try {
          const raw = await getChannelRaw(c.id);
          if (!raw) return null;
          const vids = await getRecentVideos(raw.uploadsPlaylistId, 15);
          const m = deriveMetrics(raw, vids);
          return {
            id: raw.id,
            title: raw.title,
            thumbnail: raw.thumbnail,
            subscriberCount: raw.subscriberCount,
            viewCount: raw.viewCount,
            videoCount: raw.videoCount,
            avgViews: Math.round(m.avgViews),
            uploadsPerWeek: round(m.uploadCadencePerWeek, 2),
            engagementRate: round(m.engagementRate, 4),
          };
        } catch {
          return null;
        }
      }),
    );
    const list = competitors.filter((x): x is NonNullable<typeof x> => !!x);

    if (list.length === 0) {
      res.json({ competitors: [], comparison: "No comparable channels found in this niche.", advantages: [], gaps: [] });
      return;
    }

    const myVids = await getRecentVideos(channel.uploadsPlaylistId, 15);
    const myMetrics = deriveMetrics(channel, myVids);

    const ai = await jsonCompletion<{
      comparison: string;
      advantages: string[];
      gaps: string[];
    }>(
      "You are a YouTube competitive intelligence analyst. Return strict JSON.",
      `Compare this channel against competitors and explain WHY competitors are outperforming or underperforming, in concrete terms.

My channel:
${JSON.stringify({
  title: channel.title,
  subs: channel.subscriberCount,
  avgViews: Math.round(myMetrics.avgViews),
  uploadsPerWeek: round(myMetrics.uploadCadencePerWeek, 2),
  engagementRate: round(myMetrics.engagementRate, 4),
})}

Competitors:
${JSON.stringify(list)}

Return JSON: { comparison: 2-3 sentences, advantages: string[] (what I do better, up to 3), gaps: string[] (what they do better, up to 4) }`,
      { temperature: 0.5 },
    );

    res.json({
      competitors: list,
      comparison: ai.comparison,
      advantages: ai.advantages,
      gaps: ai.gaps,
    });
  } catch (err) {
    next(err);
  }
});

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

router.get("/channels/:channelId/content-plan", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 15);
    const metrics = deriveMetrics(channel, videos);
    const result = await cached(
      `content-plan:${channel.id}`,
      30 * 60_000,
      () =>
        jsonCompletion<{
          cadenceAdvice: string;
          schedule: { day: string; topic: string; format: string; hook: string; why: string }[];
        }>(
          "You are a YouTube content strategist. Return strict JSON.",
          `Build a 7-day content plan for this channel.
Channel: ${channel.title}
Subs: ${channel.subscriberCount}
Recent titles: ${videos.slice(0, 8).map((v) => `"${v.title}"`).join(", ")}
Current cadence: ${metrics.uploadCadencePerWeek.toFixed(2)}/week
Best posting hour: ${metrics.bestPostingHour ?? "unknown"} UTC

Return JSON: {
  cadenceAdvice: '1-2 sentence cadence recommendation',
  schedule: [{day: 'Mon'..'Sun', topic, format (long/short/live), hook (1 line), why}, ...exactly 7]
}`,
          { temperature: 0.85 }
        )
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/channels/:channelId/forecast", async (req, res, next) => {
  try {
    const channel = await getChannelRaw(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    const result = await cached(
      `forecast:${channel.id}`,
      30 * 60_000,
      () =>
        jsonCompletion<{
          projectedSubs30d: number;
          projectedViews30d: number;
          confidence: "low" | "medium" | "high";
          summary: string;
          drivers: string[];
          risks: string[];
        }>(
          "You are a YouTube growth forecaster. Return strict JSON. Be realistic, not optimistic.",
          `Forecast the next 30 days for this channel.
Title: ${channel.title}
Current subs: ${channel.subscriberCount}
Total views: ${channel.viewCount}
Avg recent views: ${Math.round(metrics.avgViews)}
Engagement rate: ${(metrics.engagementRate * 100).toFixed(2)}%
Cadence: ${metrics.uploadCadencePerWeek.toFixed(2)}/week
Growth ratio (recent vs older): ${metrics.growthRatio.toFixed(2)}
Health score: ${health.score}/100

Return JSON: {
  projectedSubs30d: integer (NEW subs gained over next 30 days, can be negative),
  projectedViews30d: integer (total views over next 30 days),
  confidence: 'low'|'medium'|'high',
  summary: '2-3 sentence forecast explanation',
  drivers: [3 things working in their favor],
  risks: [3 things that could derail growth]
}`,
          { temperature: 0.5 }
        )
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
