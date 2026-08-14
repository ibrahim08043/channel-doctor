import { useState } from "react";
import { useCompareCompetitors } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChannelAvatar from "@/components/ChannelAvatar";
import { Loader2, Users, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { compactNumber, pct } from "@/lib/format";

export default function CompetitorsPanel({ channelId }: { channelId: string }) {
  const [run, setRun] = useState(false);
  const { data, isFetching, error } = useCompareCompetitors(channelId, { query: { enabled: run } as any });

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-4 w-4 text-accent" /> Competitor comparison
          </h2>
          <p className="text-xs text-muted-foreground">
            Find similar channels in your niche and see exactly why they're outperforming.
          </p>
        </div>
        <Button onClick={() => setRun(true)} disabled={isFetching || run}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
          {run ? (isFetching ? "Comparing…" : "Refresh") : "Find competitors"}
        </Button>
      </div>

      {error && <div className="text-sm text-rose-400">Could not load competitors. Try again later.</div>}

      {data && (
        <>
          {data.comparison && (
            <div className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm">
              {data.comparison}
            </div>
          )}

          {data.competitors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 text-left">Channel</th>
                    <th className="py-2 text-right">Subs</th>
                    <th className="py-2 text-right">Avg views</th>
                    <th className="py-2 text-right">Uploads/wk</th>
                    <th className="py-2 text-right">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitors.map((c) => (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="py-2">
                        <a
                          href={`https://www.youtube.com/channel/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 hover:text-primary"
                        >
                          <ChannelAvatar src={c.thumbnail} alt={c.title} className="h-6 w-6 rounded-full" />
                          <span className="truncate">{c.title}</span>
                        </a>
                      </td>
                      <td className="py-2 text-right">{compactNumber(c.subscriberCount)}</td>
                      <td className="py-2 text-right">{compactNumber(c.avgViews)}</td>
                      <td className="py-2 text-right">{c.uploadsPerWeek.toFixed(1)}</td>
                      <td className="py-2 text-right">{pct(c.engagementRate, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {data.advantages.length > 0 && (
              <div className="space-y-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Where you win
                </div>
                <ul className="space-y-1 text-sm">
                  {data.advantages.map((a, i) => (
                    <li key={i} className="text-muted-foreground">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.gaps.length > 0 && (
              <div className="space-y-2 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                  <AlertCircle className="h-4 w-4" /> Gaps to close
                </div>
                <ul className="space-y-1 text-sm">
                  {data.gaps.map((g, i) => (
                    <li key={i} className="text-muted-foreground">• {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
