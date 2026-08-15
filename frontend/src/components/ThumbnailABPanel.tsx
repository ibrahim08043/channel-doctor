import { useCallback, useRef, useState } from "react";
import { useThumbnailAbTest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Loader2,
  Trophy,
  UploadCloud,
  X,
  Palette,
  Eye,
  TrendingUp,
  Type,
  Sparkles,
} from "lucide-react";
import {
  isAcceptedImageType,
  readFileAsDataUrl,
  downscaleImage,
  extractDominantColors,
} from "@/lib/image";

interface UploadedThumb {
  /** Final (downscaled) data URI sent to the API. */
  value: string;
  /** Original data URI used for full-size previews & color analysis. */
  preview: string;
  name: string;
  colors: string[];
  loading: boolean;
}

const EMPTY: UploadedThumb = { value: "", preview: "", name: "", colors: [], loading: false };

const UPLOAD_FORMATS = "PNG, JPG, JPEG, WEBP";

/** Extract a helpful, human message from a thumbnail-A/B API error. */
function thumbErrorToMessage(err: unknown): string {
  const raw = (err as Error)?.message ?? "";
  if (/413|too large|tokens per minute|TPM/i.test(raw)) {
    return "The image was too large for the AI vision model (free-tier token limit). We auto-resize uploads — try a smaller image, or upgrade the Groq plan for larger images.";
  }
  if (/invalid image|not.*image|malformed/i.test(raw)) return "Please provide two valid images.";
  if (/credentials missing|GROQ_API_KEY/i.test(raw)) return "AI vision credentials missing. Set GROQ_API_KEY in backend/.env.";
  return raw || "Something went wrong while comparing thumbnails.";
}

function UploadZone({
  label,
  thumb,
  onFile,
  onUrl,
  onClear,
}: {
  label: string;
  thumb: UploadedThumb;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const commitUrl = () => {
    const trimmed = urlText.trim();
    if (trimmed) onUrl(trimmed);
    setUrlText("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {thumb.value && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      {thumb.value ? (
        <div className="relative overflow-hidden rounded-lg border border-border/60">
          <img
            src={thumb.preview || thumb.value}
            alt={`${label} preview`}
            className="aspect-video w-full object-cover"
          />
          <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {thumb.name || label}
          </div>
        </div>
      ) : (
        <>
          {urlMode ? (
            <div className="space-y-2">
              <Input
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitUrl()}
                placeholder="https://…"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={commitUrl}>
                  Use URL
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setUrlMode(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center transition-all",
                dragOver
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/60 hover:border-primary/40 hover:bg-white/3",
              )}
            >
              <UploadCloud className={cn("h-6 w-6", dragOver ? "text-primary" : "text-muted-foreground")} />
              <div className="text-sm font-medium">Drop an image or click to browse</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {UPLOAD_FORMATS} · auto-resized for AI
              </div>
              <button
                type="button"
                className="mt-1 text-xs font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setUrlMode(true);
                }}
              >
                Or paste a URL instead
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ThumbnailABPanel() {
  const [a, setA] = useState<UploadedThumb>(EMPTY);
  const [b, setB] = useState<UploadedThumb>(EMPTY);
  const [title, setTitle] = useState("");
  const m = useThumbnailAbTest();

  const handleFile = useCallback(async (slot: "A" | "B", file: File) => {
    if (!isAcceptedImageType(file.type)) {
      m.reset();
      setA((prev) => ({ ...prev, loading: false }));
      return;
    }
    const setter = slot === "A" ? setA : setB;
    try {
      const raw = await readFileAsDataUrl(file);
      const downscaled = await downscaleImage(raw);
      const colors = await extractDominantColors(raw);
      setter({
        value: downscaled,
        preview: raw,
        name: file.name,
        colors,
        loading: false,
      });
    } catch {
      setter({ ...EMPTY, loading: false });
    }
  }, []);

  const handleUrl = useCallback(
    (slot: "A" | "B", url: string) => {
      const setter = slot === "A" ? setA : setB;
      setter({ value: url, preview: url, name: "URL", colors: [], loading: false });
    },
    [],
  );

  const clear = useCallback((slot: "A" | "B") => {
    const setter = slot === "A" ? setA : setB;
    setter(EMPTY);
  }, []);

  const canCompare = a.value && b.value && !m.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCompare) return;
    m.mutate({ data: { thumbnailA: a.value, thumbnailB: b.value, title } });
  };

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" /> Thumbnail A/B (Vision AI)
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload two thumbnails — or paste their URLs — and the AI picks a winner.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <UploadZone label="Thumbnail A" thumb={a} onFile={(f) => handleFile("A", f)} onUrl={(u) => handleUrl("A", u)} onClear={() => clear("A")} />
          <UploadZone label="Thumbnail B" thumb={b} onFile={(f) => handleFile("B", f)} onUrl={(u) => handleUrl("B", u)} onClear={() => clear("B")} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Video title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The title for context" />
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={!canCompare} className="w-full shrink-0 sm:w-auto">
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {m.isPending ? "Comparing…" : "Compare thumbnails"}
          </Button>
          {(a.value || b.value) && !m.isPending && (
            <span className="text-xs text-muted-foreground">Auto-resized to stay within the AI's image limit.</span>
          )}
        </div>
      </form>

      {/* Loading state */}
      {m.isPending && (
        <div className="space-y-3">
          <div className="flex h-32 items-center justify-center rounded-lg border border-border/40 bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing thumbnails…
          </div>
        </div>
      )}

      {/* Error state */}
      {m.error && !m.isPending && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {thumbErrorToMessage(m.error)}
        </div>
      )}

      {/* Results */}
      {m.data && !m.isPending && (
        <div className="space-y-4">
          {/* Winner banner */}
          <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
            <Trophy className="h-6 w-6 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-semibold">
                Winner: Thumbnail {String(m.data.winner).toUpperCase()} ·{" "}
                {Math.round(m.data.confidence)}% confidence
              </div>
              <div className="text-xs text-muted-foreground">{m.data.analysis}</div>
            </div>
          </div>

          {/* Side-by-side previews */}
          <div className="grid gap-3 sm:grid-cols-2">
            {[["A", a], ["B", b]].map(([slot, t]) => (
              <div key={slot as string} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Thumbnail {slot as string}
                  </span>
                  {((t as UploadedThumb).colors.length > 0) && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Palette className="h-3 w-3" /> Color analysis
                    </span>
                  )}
                </div>
                <img
                  src={(t as UploadedThumb).preview || (t as UploadedThumb).value}
                  alt={`Thumbnail ${slot as string}`}
                  className="aspect-video w-full rounded-lg border border-border/60 object-cover"
                />
                {(t as UploadedThumb).colors.length > 0 && (
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                    {(t as UploadedThumb).colors.map((c, i) => (
                      <div key={i} className="h-full flex-1" style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Per-thumbnail AI breakdown */}
          <div className="grid gap-3 sm:grid-cols-2">
            {m.data.breakdown.map((bd) => (
              <div key={bd.thumbnail} className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">Thumbnail {bd.thumbnail}</div>
                  <div className="flex items-center gap-1 text-2xl font-black text-primary">
                    {Math.round(bd.ctrScore)}
                    <span className="text-xs font-medium text-muted-foreground">/100</span>
                  </div>
                </div>
                <Bar icon={TrendingUp} label="CTR prediction" value={bd.ctrScore} />
                <Bar icon={Eye} label="Clarity" value={bd.clarity} />
                <Bar icon={Sparkles} label="Emotion" value={bd.emotion} />
                <Bar icon={Palette} label="Contrast" value={bd.contrast} />
                <Bar icon={Type} label="Text readability" value={bd.textReadability} />
                <p className="text-xs text-muted-foreground">{bd.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Bar({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="font-semibold">{Math.round(clamped)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
