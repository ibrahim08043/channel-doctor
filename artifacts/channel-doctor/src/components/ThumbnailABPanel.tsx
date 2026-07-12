import { useState } from "react";
import { useThumbnailAbTest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Loader2, Trophy } from "lucide-react";

export default function ThumbnailABPanel() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [title, setTitle] = useState("");
  const m = useThumbnailAbTest();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!a.trim() || !b.trim()) return;
    m.mutate({ data: { thumbnailA: a, thumbnailB: b, title } });
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" /> Thumbnail A/B (Vision AI)
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste two image URLs (must be publicly accessible) to compare.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Thumbnail A URL</Label>
            <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="https://…" />
            {a && <img src={a} alt="A" className="aspect-video w-full rounded border border-border/60 object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Thumbnail B URL</Label>
            <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="https://…" />
            {b && <img src={b} alt="B" className="aspect-video w-full rounded border border-border/60 object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Video title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The title for context" />
        </div>
        <Button type="submit" disabled={m.isPending || !a || !b}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
        </Button>
      </form>
      {m.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(m.error as Error).message}
        </div>
      )}
      {m.data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3">
            <Trophy className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-semibold">
                Winner: Thumbnail {m.data.winner.toUpperCase()} ({m.data.confidence}% confidence)
              </div>
              <div className="text-xs text-muted-foreground">{m.data.analysis}</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {m.data.breakdown.map((bd) => (
              <div key={bd.thumbnail} className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">Thumbnail {bd.thumbnail}</div>
                  <div className="text-2xl font-bold text-primary">{bd.ctrScore}</div>
                </div>
                <Bar label="Clarity" value={bd.clarity} />
                <Bar label="Emotion" value={bd.emotion} />
                <Bar label="Contrast" value={bd.contrast} />
                <Bar label="Text Readability" value={bd.textReadability} />
                <p className="text-xs text-muted-foreground">{bd.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
