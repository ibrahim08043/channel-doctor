import type { YTChannelRaw, YTVideoSummary } from "./youtube";

export interface DerivedMetrics {
  avgViews: number;
  medianViews: number;
  recentAvgViews: number;
  earlierAvgViews: number;
  growthRatio: number;
  viewsPerSubRatio: number;
  engagementRate: number;
  uploadCadencePerWeek: number;
  bestPostingDow: number;
  bestPostingHour: number;
  consistencyScore: number;
}

export function deriveMetrics(channel: YTChannelRaw, videos: YTVideoSummary[]): DerivedMetrics {
  const sorted = [...videos].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );
  const views = sorted.map((v) => v.views);
  const avgViews = avg(views);
  const medianViews = median(views);
  const recentAvgViews = avg(views.slice(0, Math.max(1, Math.floor(views.length / 2))));
  const earlierAvgViews = avg(views.slice(Math.floor(views.length / 2)));
  const growthRatio = earlierAvgViews > 0 ? recentAvgViews / earlierAvgViews : 1;

  const viewsPerSubRatio =
    channel.subscriberCount > 0 ? avgViews / channel.subscriberCount : 0;

  const totalEngagement = sorted.reduce(
    (acc, v) => acc + v.likes + v.comments,
    0
  );
  const totalViews = views.reduce((a, b) => a + b, 0);
  const engagementRate = totalViews > 0 ? totalEngagement / totalViews : 0;

  const cadence = computeCadence(sorted.map((v) => v.publishedAt));
  const { bestPostingDow, bestPostingHour } = computeBestPosting(sorted);
  const consistencyScore = computeConsistency(sorted.map((v) => v.publishedAt));

  return {
    avgViews,
    medianViews,
    recentAvgViews,
    earlierAvgViews,
    growthRatio,
    viewsPerSubRatio,
    engagementRate,
    uploadCadencePerWeek: cadence,
    bestPostingDow,
    bestPostingHour,
    consistencyScore,
  };
}

export function healthScore(metrics: DerivedMetrics, channel: YTChannelRaw): {
  score: number;
  status: "critical" | "warning" | "healthy" | "thriving";
  breakdown: { engagement: number; consistency: number; growth: number; performance: number };
} {
  const engagement = clamp(metrics.engagementRate * 1000, 0, 100);
  const consistency = clamp(metrics.consistencyScore * 100, 0, 100);
  const growth = clamp(((metrics.growthRatio - 0.5) / 1.5) * 100, 0, 100);
  const perf = clamp(metrics.viewsPerSubRatio * 100, 0, 100);
  const score = Math.round(engagement * 0.25 + consistency * 0.25 + growth * 0.25 + perf * 0.25);

  let status: "critical" | "warning" | "healthy" | "thriving" = "warning";
  if (score >= 80) status = "thriving";
  else if (score >= 60) status = "healthy";
  else if (score >= 40) status = "warning";
  else status = "critical";

  return {
    score,
    status,
    breakdown: {
      engagement: Math.round(engagement),
      consistency: Math.round(consistency),
      growth: Math.round(growth),
      performance: Math.round(perf),
    },
  };
}

export function viewTrend(videos: YTVideoSummary[]): { date: string; views: number; videoId: string }[] {
  return [...videos]
    .sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt))
    .map((v) => ({
      date: v.publishedAt.slice(0, 10),
      views: v.views,
      videoId: v.id,
    }));
}

export function uploadCadenceSeries(videos: YTVideoSummary[]): { weekStart: string; uploads: number }[] {
  const buckets = new Map<string, number>();
  for (const v of videos) {
    const d = new Date(v.publishedAt);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, uploads]) => ({ weekStart, uploads }));
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeCadence(dates: string[]): number {
  if (dates.length < 2) return 0;
  const ts = dates.map((d) => +new Date(d)).sort((a, b) => a - b);
  const spanDays = (ts[ts.length - 1] - ts[0]) / 86400000;
  if (spanDays <= 0) return 0;
  return (dates.length / spanDays) * 7;
}

function computeConsistency(dates: string[]): number {
  if (dates.length < 3) return 0.3;
  const ts = dates.map((d) => +new Date(d)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean === 0) return 0;
  const variance =
    gaps.reduce((acc, g) => acc + Math.pow(g - mean, 2), 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp(1 - cv / 2, 0, 1);
}

function computeBestPosting(videos: YTVideoSummary[]): { bestPostingDow: number; bestPostingHour: number } {
  const byDow = new Map<number, number[]>();
  const byHour = new Map<number, number[]>();
  for (const v of videos) {
    const d = new Date(v.publishedAt);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (!byDow.has(dow)) byDow.set(dow, []);
    byDow.get(dow)!.push(v.views);
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(v.views);
  }
  let bestDow = 0;
  let bestDowAvg = -1;
  for (const [dow, vs] of byDow) {
    const a = avg(vs);
    if (a > bestDowAvg) {
      bestDowAvg = a;
      bestDow = dow;
    }
  }
  let bestHour = 0;
  let bestHourAvg = -1;
  for (const [hour, vs] of byHour) {
    const a = avg(vs);
    if (a > bestHourAvg) {
      bestHourAvg = a;
      bestHour = hour;
    }
  }
  return { bestPostingDow: bestDow, bestPostingHour: bestHour };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
