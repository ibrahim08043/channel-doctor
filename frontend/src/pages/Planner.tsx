import { useGetConnectedProfile, useGetContentPlan, useGetForecast } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Calendar, Loader2, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { compactNumber } from "@/lib/format";

export default function PlannerPage() {
  const me = useGetConnectedProfile();
  const channelId = me.data?.channelId;

  const plan = useGetContentPlan(channelId || "", { query: { enabled: !!channelId } as any });
  const forecast = useGetForecast(channelId || "", { query: { enabled: !!channelId } as any });

  if (!me.isLoading && !channelId) {
    return (
      <Card className="mx-auto max-w-xl space-y-3 p-8 text-center">
        <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Connect your channel first</h2>
        <p className="text-sm text-muted-foreground">
          The content planner builds a personalized 7-day schedule from your channel's data.
        </p>
        <div className="flex justify-center">
          <Link href="/"><Button>Find your channel</Button></Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Content planner</h1>
          <p className="text-sm text-muted-foreground">
            AI-built 7-day upload schedule + 30-day growth forecast.
          </p>
        </div>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-400" /> 30-day forecast
          </h2>
          {forecast.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {forecast.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="New subs"
                value={
                  (forecast.data.projectedSubs30d >= 0 ? "+" : "") +
                  compactNumber(forecast.data.projectedSubs30d)
                }
                accent={forecast.data.projectedSubs30d >= 0 ? "good" : "bad"}
              />
              <Stat label="Views" value={compactNumber(forecast.data.projectedViews30d)} />
              <Stat label="Confidence" value={forecast.data.confidence} accent="muted" />
            </div>
            <p className="text-sm leading-relaxed">{forecast.data.summary}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Sparkles className="h-4 w-4" /> Drivers
                </div>
                <ul className="space-y-1 text-sm">
                  {forecast.data.drivers.map((d, i) => (
                    <li key={i} className="text-muted-foreground">• {d}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                  <AlertCircle className="h-4 w-4" /> Risks
                </div>
                <ul className="space-y-1 text-sm">
                  {forecast.data.risks.map((r, i) => (
                    <li key={i} className="text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-4 w-4 text-primary" /> This week's schedule
          </h2>
          {plan.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {plan.data && (
          <>
            <div className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm">
              {plan.data.cadenceAdvice}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plan.data.schedule.map((d) => (
                <div key={d.day} className="space-y-2 rounded-md border border-border/60 p-4 hover-elevate">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-primary">{d.day}</div>
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase">
                      {d.format}
                    </span>
                  </div>
                  <div className="text-sm font-semibold">{d.topic}</div>
                  <p className="text-xs italic text-muted-foreground">"{d.hook}"</p>
                  <p className="text-xs text-muted-foreground">{d.why}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "good" | "bad" | "muted";
}) {
  const color =
    accent === "good"
      ? "text-emerald-300"
      : accent === "bad"
        ? "text-rose-300"
        : accent === "muted"
          ? "text-muted-foreground capitalize"
          : "";
  return (
    <div className="rounded-md border border-border/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
