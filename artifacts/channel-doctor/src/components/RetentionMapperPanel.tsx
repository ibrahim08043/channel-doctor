import { useState } from "react";
import type { VideoSummary } from "@workspace/api-client-react";
import { useRetentionMapper } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, LineChart, AlertTriangle } from "lucide-react";
import { Line } from "react-chartjs-2";
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from "chart.js";

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

const SEVERITY: Record<string, string> = {
  minor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  major: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

export default function RetentionMapperPanel({ videos }: { videos: VideoSummary[] }) {
  const [picked, setPicked] = useState<VideoSummary | null>(videos[0] ?? null);
  const m = useRetentionMapper();

  const run = () => {
    if (!picked) return;
    m.mutate({ data: { videoId: picked.id, title: picked.title, durationSeconds: picked.durationSeconds } });
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-4 w-4 text-primary" /> Retention Mapper
        </h2>
        <p className="text-sm text-muted-foreground">
          AI-predicted retention curve & dropoff diagnosis for any video.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={picked?.id || ""}
          onChange={(e) => setPicked(videos.find((v) => v.id === e.target.value) ?? null)}
        >
          {videos.map((v) => (
            <option key={v.id} value={v.id}>{v.title.slice(0, 80)}</option>
          ))}
        </select>
        <Button onClick={run} disabled={!picked || m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Predict retention"}
        </Button>
      </div>
      {m.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(m.error as Error).message}
        </div>
      )}
      {m.data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{m.data.summary}</p>
          <div className="h-56">
            <Line
              data={{
                labels: m.data.curve.map((p) => `${Math.floor(p.secondsIn / 60)}:${String(p.secondsIn % 60).padStart(2,"0")}`),
                datasets: [
                  {
                    data: m.data.curve.map((p) => p.estimatedRetentionPct),
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
                  y: { min: 0, max: 100, ticks: { color: "#a1a1aa", callback: (v) => `${v}%` }, grid: { color: "rgba(255,255,255,0.05)" } },
                  x: { ticks: { color: "#a1a1aa" }, grid: { display: false } },
                },
              }}
            />
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-400" /> Predicted dropoffs</h3>
            <ul className="space-y-2">
              {m.data.dropoffs.map((d, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY[d.severity]}`}>{d.severity}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmt(d.startSec)} → {fmt(d.endSec)}
                    </span>
                  </div>
                  <div className="text-sm"><span className="font-medium">Likely cause:</span> {d.cause}</div>
                  <div className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Fix:</span> {d.fix}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            <span className="font-semibold text-primary">Hook advice: </span>
            {m.data.hookAdvice}
          </div>
        </div>
      )}
    </Card>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
