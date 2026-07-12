import type { ChannelDetails } from "@workspace/api-client-react";
import { compactNumber, healthBadge, healthColor, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";

export default function ChannelHeader({ data }: { data: ChannelDetails }) {
  return (
    <Card className="overflow-hidden">
      {data.bannerUrl && (
        <div
          className="h-32 w-full bg-cover bg-center sm:h-44"
          style={{ backgroundImage: `url(${data.bannerUrl})` }}
        />
      )}
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:gap-8">
        <img
          src={data.thumbnail}
          alt={data.title}
          className="h-24 w-24 rounded-full border-4 border-background shadow-xl sm:h-28 sm:w-28"
        />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">{data.title}</h1>
            <div className={`inline-flex items-center gap-1.5 rounded-full border border-current/30 bg-current/10 px-3 py-1 text-xs font-semibold ${healthColor(data.healthScore)}`}>
              <Activity className="h-3.5 w-3.5" />
              {data.healthScore} · {healthBadge(data.healthScore)}
            </div>
          </div>
          <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground">
            {data.description || "No description"}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground sm:grid-cols-4">
            <Stat label="Subscribers" value={data.hiddenSubscriberCount ? "Hidden" : compactNumber(data.subscriberCount)} />
            <Stat label="Total Views" value={compactNumber(data.viewCount)} />
            <Stat label="Videos" value={compactNumber(data.videoCount)} />
            <Stat label="Joined" value={formatDate(data.publishedAt)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
