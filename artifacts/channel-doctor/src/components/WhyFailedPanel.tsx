import { useState } from "react";
import type { VideoSummary } from "@workspace/api-client-react";
import { useDiagnoseVideo } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertOctagon } from "lucide-react";

const SEVERITY: Record<string, string> = {
  minor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  major: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export default function WhyFailedPanel({ channelId, videos }: { channelId: string; videos: VideoSummary[] }) {
  const sorted = [...videos].sort((a, b) => a.views - b.views);
  const [picked, setPicked] = useState<VideoSummary | null>(sorted[0] ?? null);
  const m = useDiagnoseVideo();

  const run = () => {
    if (!picked) return;
    m.mutate({ data: { videoId: picked.id, channelId } });
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AlertOctagon className="h-4 w-4 text-primary" /> Why It Failed
        </h2>
        <p className="text-sm text-muted-foreground">
          Forensic AI diagnosis on an underperforming video.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={picked?.id || ""}
          onChange={(e) => setPicked(videos.find((v) => v.id === e.target.value) ?? null)}
        >
          {sorted.map((v) => (
            <option key={v.id} value={v.id}>{v.title.slice(0, 80)} · {v.views.toLocaleString()} views</option>
          ))}
        </select>
        <Button onClick={run} disabled={!picked || m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Diagnose"}
        </Button>
      </div>
      {m.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(m.error as Error).message}
        </div>
      )}
      {m.data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-sm">{m.data.verdict}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Performance vs channel avg:{" "}
              <span className={m.data.gapVsAverage < 0 ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {m.data.gapVsAverage > 0 ? "+" : ""}
                {m.data.gapVsAverage}%
              </span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Reasons</h3>
            <ul className="space-y-2">
              {m.data.reasons.map((r, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY[r.severity] || ""}`}>
                      {r.severity}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">{r.category}</span>
                  </div>
                  <p className="text-sm">{r.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Fixes</h3>
            <ul className="space-y-1.5 text-sm">
              {m.data.fixes.map((f, i) => (
                <li key={i} className="rounded-md border border-border/60 bg-card/60 p-2">
                  <span className="font-medium">{f.action}</span>
                  <span className="text-muted-foreground"> — {f.impact}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Stronger title alternatives</h3>
            <ul className="space-y-1.5 text-sm">
              {m.data.titleAlternatives.map((t, i) => (
                <li key={i} className="rounded-md border border-primary/30 bg-primary/5 p-2">{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
