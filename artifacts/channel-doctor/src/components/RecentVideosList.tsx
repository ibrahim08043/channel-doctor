import type { VideoSummary } from "@workspace/api-client-react";
import { compactNumber, formatDate, formatDuration } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Eye, Heart, MessageSquare } from "lucide-react";

export default function RecentVideosList({
  videos,
  onPick,
  pickLabel,
}: {
  videos: VideoSummary[];
  onPick?: (v: VideoSummary) => void;
  pickLabel?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <Card key={v.id} className="overflow-hidden">
          <div className="relative">
            <img src={v.thumbnail} alt={v.title} className="aspect-video w-full object-cover" />
            <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              {formatDuration(v.durationSeconds)}
            </div>
          </div>
          <div className="space-y-2 p-3">
            <a
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary"
            >
              {v.title}
            </a>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {compactNumber(v.views)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" /> {compactNumber(v.likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> {compactNumber(v.comments)}
              </span>
              <span>· {formatDate(v.publishedAt)}</span>
            </div>
            {onPick && (
              <button
                type="button"
                onClick={() => onPick(v)}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                {pickLabel || "Pick this video"}
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
