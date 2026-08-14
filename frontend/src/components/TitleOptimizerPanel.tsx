import { useState } from "react";
import { useOptimizeTitle } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Wand2, Copy } from "lucide-react";

export default function TitleOptimizerPanel({ defaultTitle, channelTitle }: { defaultTitle?: string; channelTitle?: string }) {
  const [title, setTitle] = useState(defaultTitle || "");
  const opt = useOptimizeTitle();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    opt.mutate({ data: { currentTitle: title, channelTitle } });
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wand2 className="h-4 w-4 text-primary" /> Title Optimizer
        </h2>
        <p className="text-sm text-muted-foreground">
          Get 10 high-CTR title alternatives with click scores.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your current or working title…"
          className="flex-1"
        />
        <Button type="submit" disabled={opt.isPending || !title.trim()}>
          {opt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Optimize"}
        </Button>
      </form>
      {opt.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(opt.error as Error).message}
        </div>
      )}
      {opt.data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{opt.data.analysis}</p>
          <ul className="space-y-2">
            {opt.data.titles.map((t, i) => (
              <li key={i} className="group rounded-lg border border-border/60 bg-card/60 p-3 hover-elevate">
                <div className="flex items-start gap-3">
                  <ScoreRing score={t.ctrScore} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{t.title}</p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(t.title)}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                        aria-label="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-primary">{t.style}</div>
                    <p className="text-xs text-muted-foreground">{t.reasoning}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-cyan-400" : score >= 40 ? "text-amber-400" : "text-rose-400";
  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-current/40 bg-current/10 text-sm font-bold ${tone}`}>
      {score}
    </div>
  );
}
