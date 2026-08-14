import { useState } from "react";
import type { VideoSummary } from "@workspace/api-client-react";
import { useRetentionMapper } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LineChart, AlertTriangle } from "lucide-react";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from "chart.js";

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

// ── TypeScript interfaces matching the API response ─────────────────────────
// The backend `retention-mapper` endpoint returns { summary, curve, dropoffs,
// hookAdvice }. Older/deployed builds returned a per-video object shaped like
// { videoTitle, videoLength, avgWatchTime, retentionRate }. We keep the types
// loose and normalize both shapes defensively at render time so a stray object
// can NEVER be rendered raw (that produced the "Objects are not valid as a
// React child" crash).

type Severity = "minor" | "major" | "critical";

interface RetentionCurvePoint {
  secondsIn: number;
  estimatedRetentionPct: number;
}

interface RetentionDropoff {
  startSec: number;
  endSec: number;
  severity: Severity;
  cause: string;
  fix: string;
}

/** A video-level segment reported by some older API versions. */
interface RetentionSegment {
  videoTitle?: string;
  videoLength?: number | string;
  avgWatchTime?: number | string;
  retentionRate?: number | string;
}

interface RetentionResult {
  summary: string;
  curve: RetentionCurvePoint[];
  dropoffs: RetentionDropoff[];
  hookAdvice: string;
  // Legacy per-video segments (only populated when the API returns that shape).
  segments: RetentionSegment[];
}

const SEVERITY: Record<Severity, string> = {
  minor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  major: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

/** Render any value safely as text — never throws on objects/arrays. */
function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Best-effort string for a single key nested anywhere in the raw response. */
function pick(obj: unknown, key: string): unknown {
  if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
  return undefined;
}

/**
 * Normalize the raw API response. The deployed endpoint returns
 * { summary, curve[], dropoffs[], hookAdvice }. If the response instead looks
 * like the older segment shape ({ videoTitle, videoLength, avgWatchTime,
 * retentionRate }) — or wraps either in `data`/`result` — we flatten it so
 * every field rendered below is a primitive, never an object.
 */
function normalizeResult(raw: unknown): RetentionResult {
  if (!raw || typeof raw !== "object") {
    return { summary: "", curve: [], dropoffs: [], hookAdvice: "", segments: [] };
  }
  const root = raw as Record<string, unknown>;
  const inner =
    (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;

  // ── Legacy segment shape (array of per-video objects) ────────────────────
  const curveLike = inner.curve;
  const isLegacySegments =
    Array.isArray(curveLike) &&
    curveLike.length > 0 &&
    (typeof curveLike[0] === "object") &&
    ("videoTitle" in curveLike[0] || "retentionRate" in curveLike[0]);

  if (isLegacySegments) {
    const segments = (curveLike as RetentionSegment[]).map((s) => ({
      videoTitle: asText(s.videoTitle),
      videoLength: s.videoLength,
      avgWatchTime: s.avgWatchTime,
      retentionRate: s.retentionRate,
    }));
    const avgRetention =
      segments.length > 0
        ? Math.round(
            segments.reduce((sum, s) => sum + asNumber(s.retentionRate), 0) / segments.length,
          )
        : 0;
    const avgWatch = asNumber(pick(segments[0], "avgWatchTime"));
    const title = asText(pick(segments[0], "videoTitle"));
    return {
      summary:
        avgWatch > 0 || title
          ? `${title ? `"${title}": ` : ""}average watch time ${avgWatch}s — predicted retention ${avgRetention}%.`
          : "Retention analysis returned per-video data.",
      curve: segments.map((s, i) => ({
        secondsIn: Math.max(0, Math.round(i * 30)),
        estimatedRetentionPct: Math.max(0, Math.min(100, Math.round(asNumber(s.retentionRate)))),
      })),
      dropoffs: [],
      hookAdvice: "",
      segments,
    };
  }

  // ── Current shape ─────────────────────────────────────────────────────────
  const rawSummary = inner.summary;
  const rawHook = inner.hookAdvice;
  return {
    summary: asText(rawSummary) || "Retention analysis unavailable.",
    curve: Array.isArray(inner.curve)
      ? (inner.curve as unknown[])
          .map((p) => ({
            secondsIn: Math.max(0, Math.round(asNumber(pick(p, "secondsIn")))),
            estimatedRetentionPct: Math.max(
              0,
              Math.min(100, Math.round(asNumber(pick(p, "estimatedRetentionPct"), 100))),
            ),
          }))
          .filter((p) => Number.isFinite(p.secondsIn) && Number.isFinite(p.estimatedRetentionPct))
      : [],
    dropoffs: Array.isArray(inner.dropoffs)
      ? (inner.dropoffs as unknown[]).map((d) => ({
          startSec: Math.max(0, Math.round(asNumber(pick(d, "startSec")))),
          endSec: Math.max(0, Math.round(asNumber(pick(d, "endSec")))),
          severity: (["minor", "major", "critical"].includes(asText(pick(d, "severity")))
            ? asText(pick(d, "severity"))
            : "major") as Severity,
          cause: asText(pick(d, "cause")),
          fix: asText(pick(d, "fix")),
        }))
      : [],
    hookAdvice: asText(rawHook) || "",
    segments: [],
  };
}

/** Format seconds as M:SS. */
function fmt(s: number) {
  const secs = Math.max(0, Math.floor(s));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export default function RetentionMapperPanel({ videos }: { videos: VideoSummary[] }) {
  const [picked, setPicked] = useState<VideoSummary | null>(videos[0] ?? null);
  const m = useRetentionMapper();

  const run = () => {
    if (!picked) return;
    m.mutate({
      data: { videoId: picked.id, title: picked.title, durationSeconds: picked.durationSeconds },
    });
  };

  const data: RetentionResult | undefined = m.data ? normalizeResult(m.data as unknown) : undefined;

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-4 w-4 text-primary" /> Retention Mapper
        </h2>
        <p className="text-sm text-muted-foreground">
          AI-predicted retention curve &amp; dropoff diagnosis for any video.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={picked?.id || ""}
          onChange={(e) => setPicked(videos.find((v) => v.id === e.target.value) ?? null)}
        >
          {videos.length === 0 && <option value="">No videos available</option>}
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {asText(v.title).slice(0, 80)}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={!picked || m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Predict retention"}
        </Button>
      </div>

      {/* Loading state */}
      {m.isPending && (
        <div className="space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      )}

      {/* Error state */}
      {m.error && !m.isPending && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {asText((m.error as Error).message) || "Retention analysis failed. Please try again."}
        </div>
      )}

      {/* Results */}
      {data && !m.isPending && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{data.summary || "No summary returned."}</p>

          {/* Legacy per-video segments (rendered property-by-property) */}
          {data.segments.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Predicted retention per video
              </h3>
              <ul className="space-y-2">
                {data.segments.map((seg, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm"
                  >
                    <p className="font-medium">{asText(seg.videoTitle) || "Video"}</p>
                    <p className="text-muted-foreground">
                      Length: {asText(seg.videoLength) || "—"}s · Avg watch:{" "}
                      {asText(seg.avgWatchTime) || "—"}s · Retention:{" "}
                      {asText(seg.retentionRate) || "—"}%
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.curve.length > 0 && (
            <div className="h-56">
              <Line
                data={{
                  labels: data.curve.map((p) =>
                    `${Math.floor(p.secondsIn / 60)}:${String(p.secondsIn % 60).padStart(2, "0")}`,
                  ),
                  datasets: [
                    {
                      data: data.curve.map((p) => p.estimatedRetentionPct),
                      borderColor: "#06b6d4",
                      backgroundColor: "rgba(6, 182, 212, 0.15)",
                      tension: 0.35,
                      fill: true,
                      pointRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      min: 0,
                      max: 100,
                      ticks: { color: "#a1a1aa", callback: (v) => `${v}%` },
                      grid: { color: "rgba(255,255,255,0.05)" },
                    },
                    x: { ticks: { color: "#a1a1aa" }, grid: { display: false } },
                  },
                }}
              />
            </div>
          )}

          {data.dropoffs.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Predicted dropoffs
              </h3>
              <ul className="space-y-2">
                {data.dropoffs.map((d, i) => (
                  <li key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          SEVERITY[d.severity] ?? SEVERITY.major
                        }`}
                      >
                        {asText(d.severity)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmt(d.startSec)} → {fmt(d.endSec)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Likely cause:</span> {asText(d.cause)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Fix:</span> {asText(d.fix)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.hookAdvice && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <span className="font-semibold text-primary">Hook advice: </span>
              {data.hookAdvice}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
