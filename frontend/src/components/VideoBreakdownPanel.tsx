import { useState } from "react";
import { useGetVideoBreakdown } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Sparkles } from "lucide-react";
import { compactNumber } from "@/lib/format";

const hookColor: Record<string, string> = {
  weak: "bg-rose-500/15 text-rose-300",
  ok: "bg-amber-500/15 text-amber-300",
  strong: "bg-emerald-500/15 text-emerald-300",
};
const ctrColor: Record<string, string> = {
  low: "bg-rose-500/15 text-rose-300",
  average: "bg-amber-500/15 text-amber-300",
  high: "bg-cyan-500/15 text-cyan-300",
  viral: "bg-fuchsia-500/15 text-fuchsia-300",
};

export default function VideoBreakdownPanel({ channelId }: { channelId: string }) {
  const [run, setRun] = useState(false);
  const { data, isFetching, error } = useGetVideoBreakdown(channelId, { query: { enabled: run } as any });

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Per-video AI breakdown
          </h2>
          <p className="text-xs text-muted-foreground">
            Title score, hook strength, and estimated CTR for your recent uploads.
          </p>
        </div>
        <Button onClick={() => setRun(true)} disabled={isFetching || run}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {run ? (isFetching ? "Analyzing…" : "Refresh") : "Run breakdown"}
        </Button>
      </div>

      {error && <div className="text-sm text-rose-400">Could not load breakdown. Try again.</div>}

      {data && data.items.length === 0 && (
        <div className="text-sm text-muted-foreground">No recent videos to analyze.</div>
      )}

      {data && data.items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.items.map((it) => (
            <a
              key={it.videoId}
              href={`https://www.youtube.com/watch?v=${it.videoId}`}
              target="_blank"
              rel="noreferrer"
              className="hover-elevate flex gap-3 rounded-md border border-border/60 p-3"
            >
              <img src={it.thumbnail} alt="" className="h-20 w-32 rounded object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="line-clamp-2 text-sm font-medium">{it.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                    Title {Math.round(it.titleScore)}/100
                  </span>
                  <span className={`rounded px-1.5 py-0.5 ${hookColor[it.hookStrength]}`}>
                    Hook {it.hookStrength}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 ${ctrColor[it.ctrCategory]}`}>
                    CTR {it.ctrCategory}
                  </span>
                  <span className="text-muted-foreground">· {compactNumber(it.views)} views</span>
                </div>
                <p className="text-xs text-muted-foreground">{it.verdict}</p>
                <p className="text-xs text-muted-foreground italic">Thumb: {it.thumbnailCritique}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
