import type { ChannelDetails } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { compactNumber, pct, dayOfWeek, healthColor } from "@/lib/format";
import { TrendingUp, TrendingDown, Eye, Heart, Calendar, Clock, Users, Activity } from "lucide-react";

export default function MetricGrid({ data }: { data: ChannelDetails }) {
  const metrics = [
    {
      icon: Eye,
      label: "Avg Views / Video",
      value: compactNumber(data.avgViews),
      sub: `Median ${compactNumber(data.medianViews)}`,
    },
    {
      icon: Users,
      label: "Views ÷ Subs",
      value: data.viewsPerSubRatio.toFixed(2) + "x",
      sub:
        data.viewsPerSubRatio >= 1
          ? "Reach beyond subs"
          : "Below subscriber base",
    },
    {
      icon: Heart,
      label: "Engagement Rate",
      value: pct(data.engagementRate, 2),
      sub: "Likes + comments / views",
    },
    {
      icon: data.growthRatio >= 1 ? TrendingUp : TrendingDown,
      label: "Recent Growth",
      value: data.growthRatio.toFixed(2) + "x",
      sub: data.growthRatio >= 1 ? "Trending up" : "Trending down",
      tone: data.growthRatio >= 1 ? "up" : "down",
    },
    {
      icon: Calendar,
      label: "Upload Cadence",
      value: data.uploadCadencePerWeek.toFixed(1) + "/wk",
      sub: "Recent average",
    },
    {
      icon: Clock,
      label: "Best Posting Slot",
      value: `${dayOfWeek(data.bestPostingHour.dayOfWeek)} ${String(data.bestPostingHour.hour).padStart(2, "0")}:00 UTC`,
      sub: "Highest avg views",
    },
    {
      icon: Activity,
      label: "Health Score",
      value: String(data.healthScore),
      sub: data.healthStatus,
      tone: data.healthScore >= 60 ? "up" : "down",
      colorClass: healthColor(data.healthScore),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {m.label}
            </span>
            <m.icon
              className={`h-4 w-4 ${
                m.tone === "up"
                  ? "text-emerald-400"
                  : m.tone === "down"
                  ? "text-rose-400"
                  : "text-muted-foreground"
              }`}
            />
          </div>
          <div className={`text-2xl font-bold leading-tight break-anywhere ${(m as any).colorClass || ""}`}>
            {m.value}
          </div>
          <div className="text-xs text-muted-foreground">{m.sub}</div>
        </Card>
      ))}
    </div>
  );
}
