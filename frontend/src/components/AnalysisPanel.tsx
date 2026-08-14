import { useState } from "react";
import { useAnalyzeChannel, useGenerateContentIdeas } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Lightbulb, Target, Sparkles } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export default function AnalysisPanel({ channelId, channelTitle }: { channelId: string; channelTitle: string }) {
  const [run, setRun] = useState(false);
  const { data, isFetching, error } = useAnalyzeChannel(channelId, {
    query: { enabled: run } as any,
  });
  const ideas = useGenerateContentIdeas();

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI Growth Diagnosis
          </h2>
          <p className="text-sm text-muted-foreground">
            Brutally honest, AI-generated growth strategy for this channel.
          </p>
        </div>
        {!run && (
          <Button onClick={() => setRun(true)}>Run AI analysis</Button>
        )}
      </div>

      {isFetching && (
        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Diagnosing channel… this can take 10–20 seconds.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <div className="space-y-5">
          <p className="text-base leading-relaxed">{data.diagnosis}</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Block title="Strengths" icon={CheckCircle2} tone="emerald" items={data.strengths} />
            <Block title="Weaknesses" icon={AlertCircle} tone="rose" items={data.weaknesses} />
            <Block title="Opportunities" icon={Lightbulb} tone="amber" items={data.opportunities} />
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" /> Next Actions
            </h3>
            <ul className="space-y-2">
              {data.nextActions.map((a, i) => (
                <li key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLES[a.priority] || ""}`}>
                      {a.priority}
                    </span>
                    <span className="flex-1 text-sm font-medium">{a.action}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Impact: {a.impact}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Niche:</span> {data.contentNiche}
            <span className="mx-2">·</span>
            <span className="font-medium text-foreground">Audience:</span> {data.audienceInsight}
          </div>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Fresh content ideas</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={ideas.isPending}
                onClick={() =>
                  ideas.mutate({ data: { topic: data.contentNiche, channelTitle } })
                }
              >
                {ideas.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate 8 ideas"}
              </Button>
            </div>
            {ideas.data && (
              <div className="grid gap-2 sm:grid-cols-2">
                {ideas.data.ideas.map((idea, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-card/40 p-3">
                    <div className="text-sm font-semibold">{idea.title}</div>
                    <div className="mt-1 text-xs italic text-muted-foreground">"{idea.hook}"</div>
                    <div className="mt-1.5 text-[10px] uppercase tracking-wider text-primary">
                      {idea.format}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{idea.why}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Block({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: any;
  tone: "emerald" | "rose" | "amber";
  items: string[];
}) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[tone]}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="space-y-1.5 text-sm text-foreground/90">
        {items.map((it, i) => (
          <li key={i}>• {it}</li>
        ))}
      </ul>
    </div>
  );
}
