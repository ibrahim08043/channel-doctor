import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useAnalyzeSocial, useGenerateSocialReport } from "@workspace/api-client-react";
import type {
  SocialAnalysisResult,
  InstagramInsights,
  FacebookInsights,
  SocialBioVersion,
  SocialContentPillar,
  SocialHashtagCluster,
  SocialRoadmapPhase,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram,
  Facebook,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  ChevronRight,
  Sparkles,
  Hash,
  MessageSquare,
  Eye,
  BarChart3,
  Download,
  FileText,
  Target,
  Zap,
  Copy,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fadeUp, stagger, scaleIn } from "@/lib/motion";
import { useToast } from "@/hooks/use-toast";
import { useAiSettings } from "@/providers/SettingsProvider";

function SocialDocxButton({ analysis }: { analysis: any }) {
  const gen = useGenerateSocialReport();
  const { toast } = useToast();
  const platformLabel = analysis.platform === "instagram" ? "Instagram" : "Facebook";

  const download = async () => {
    try {
      const result = await gen.mutateAsync({ data: { analysis } });
      const binary = atob(result.docxBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded", description: result.filename });
    } catch {
      toast({ title: "Export failed", description: "Try again in a moment.", variant: "destructive" });
    }
  };

  return (
    <button
      onClick={download}
      disabled={gen.isPending}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/8 disabled:opacity-50"
    >
      {gen.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4 text-primary" />
      )}
      {gen.isPending ? `Generating ${platformLabel} report…` : `Export DOCX report`}
    </button>
  );
}

type Platform = "instagram" | "facebook";

const PLATFORMS = [
  {
    id: "instagram" as Platform,
    label: "Instagram",
    icon: Instagram,
    color: "platform-instagram",
    placeholder: "@creator or username",
    gradient: "from-rose-500/20 to-fuchsia-500/20",
  },
  {
    id: "facebook" as Platform,
    label: "Facebook",
    icon: Facebook,
    color: "platform-facebook",
    placeholder: "Page name or @handle",
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
];

const SCORE_COLOR = (n: number) =>
  n >= 75 ? "text-emerald-300" : n >= 55 ? "text-amber-300" : "text-rose-300";

const SCORE_BG = (n: number) =>
  n >= 75
    ? "bg-emerald-500/12 border-emerald-500/25"
    : n >= 55
    ? "bg-amber-500/12 border-amber-500/25"
    : "bg-rose-500/12 border-rose-500/25";

const SCORE_BAR = (n: number) =>
  n >= 75 ? "bg-emerald-400" : n >= 55 ? "bg-amber-400" : "bg-rose-400";

const TREND_ICON = (t: string) => {
  if (t === "growing") return <TrendingUp className="h-4 w-4 text-emerald-300" />;
  if (t === "declining") return <TrendingDown className="h-4 w-4 text-rose-300" />;
  return <Minus className="h-4 w-4 text-amber-300" />;
};

const LOADING_STEPS = [
  "Fetching profile intelligence…",
  "Analyzing content patterns…",
  "Evaluating engagement signals…",
  "Generating platform deep-dive…",
  "Building growth strategies…",
  "Compiling your report…",
];

/** Hard client-side ceiling. The backend also aborts at 120s, so this is a
 *  safety net that guarantees the UI never spins forever. */
const ANALYZE_TIMEOUT_MS = 130_000;

/** Turn a thrown error into an actionable message. */
function socialErrorToMessage(err: unknown, platform: Platform): string {
  const e = err as { message?: string; data?: { error?: string } } | null | undefined;
  const raw = (e && (e.message ?? "")) || "";
  // Backend returns a helpful error in the body for credential/timeout cases.
  if (e?.data?.error) return e.data.error;
  if (/timed out|aborted|timeout|504/i.test(raw)) return `${platform} API request timed out`;
  if (/credentials missing|GROQ_API_KEY/i.test(raw)) return "Instagram API credentials missing";
  if (/HTTP 500/i.test(raw)) return `${platform} analyzer is temporarily unavailable. Try again in a moment.`;
  return raw || "Something went wrong";
}

const IMPACT_DOT: Record<string, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

type IGTab = "overview" | "profile" | "content" | "captions" | "engagement";
type FBTab = "overview" | "branding" | "content" | "roadmap";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/8">
      <motion.div
        className={cn("h-full rounded-full", SCORE_BAR(score))}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.7, delay, ease: "easeOut" }}
      />
    </div>
  );
}

function TabNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: any }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/3 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all",
            active === t.id
              ? "bg-primary/20 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          {t.icon && <t.icon className="h-3 w-3" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Instagram Deep-Dive Sections ───────────────────────────────────────────

function IGProfileTab({ d }: { d: InstagramInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      {/* Username analysis */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Username & Handle Analysis</h3>
            <ScoreBadge score={d.usernameScore} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.usernameAlts.map((alt, i) => (
              <div
                key={i}
                className="space-y-1 rounded-xl border border-white/10 bg-white/4 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">@{alt.handle}</span>
                  <CopyButton text={`@${alt.handle}`} />
                </div>
                <p className="text-xs text-muted-foreground">{alt.reason}</p>
              </div>
            ))}
          </div>
          <p className="rounded-lg bg-primary/8 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-primary">Profile branding: {d.profileBrandingScore}/100 — </span>
            {d.profileNotes}
          </p>
        </Card>
      </motion.div>

      {/* Bio optimization */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Bio Optimization Engine</h3>
              <p className="text-xs text-muted-foreground mt-0.5">3 optimized versions for different goals</p>
            </div>
            <ScoreBadge score={d.bioScore} />
          </div>
          {d.bioIssues.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Issues found
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.bioIssues.map((issue, i) => (
                  <span key={i} className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {d.bioVersions.map((v: SocialBioVersion, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/4 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    i === 0 ? "border-primary/30 bg-primary/15 text-primary"
                    : i === 1 ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300"
                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  )}>
                    {v.type}
                  </span>
                  <CopyButton text={v.bio} />
                </div>
                <p className="text-sm font-medium leading-snug">{v.bio}</p>
                <p className="text-xs text-muted-foreground border-t border-white/8 pt-2">{v.reasoning}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function IGContentTab({ d }: { d: InstagramInsights }) {
  const total = d.contentPillars.reduce((a, p) => a + p.percentage, 0);
  const colors = ["bg-primary", "bg-accent", "bg-fuchsia-400", "bg-amber-400", "bg-emerald-400"];
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      {/* Content Mix */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="font-semibold text-sm">Content Mix Analysis</h3>
          {/* Stacked bar */}
          <div className="h-4 flex overflow-hidden rounded-full">
            {d.contentPillars.map((p: SocialContentPillar, i) => (
              <motion.div
                key={p.name}
                className={cn("h-full", colors[i % colors.length])}
                initial={{ flex: 0 }}
                animate={{ flex: p.percentage }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
                title={`${p.name}: ${p.percentage}%`}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {d.contentPillars.map((p: SocialContentPillar, i) => (
              <div key={p.name} className="flex items-center gap-2 text-sm">
                <div className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", colors[i % colors.length])} />
                <span className="text-muted-foreground flex-1">{p.name}</span>
                <span className="font-semibold tabular-nums">{p.percentage}%</span>
                <span className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  p.strength === "strong" ? "border-emerald-500/25 text-emerald-300" :
                  p.strength === "overused" ? "border-rose-500/25 text-rose-300" :
                  "border-amber-500/25 text-amber-300"
                )}>
                  {p.strength}
                </span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {d.weakTopics.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
                <div className="mb-1.5 text-xs font-semibold text-amber-300">Content gaps</div>
                <ul className="space-y-1">
                  {d.weakTopics.map((t, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-amber-300 shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.overusedTopics.length > 0 && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-3">
                <div className="mb-1.5 text-xs font-semibold text-rose-300">Overused topics</div>
                <ul className="space-y-1">
                  {d.overusedTopics.map((t, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-rose-300 shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Reels Intelligence */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="font-semibold text-sm">Reels Intelligence</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Reel Score", value: d.reelScore, icon: Eye },
              { label: "Hook Score", value: d.hookScore, icon: Zap },
              { label: "Viral Prob.", value: d.viralProbability, icon: TrendingUp },
            ].map((m) => (
              <div key={m.label} className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-3 text-center">
                <m.icon className={cn("mx-auto h-4 w-4", SCORE_COLOR(m.value))} />
                <div className={cn("text-xl font-black", SCORE_COLOR(m.value))}>{m.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                <ScoreBar score={m.value} />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {d.reelRecommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-bold text-primary">{i + 1}.</span>
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function IGCaptionsTab({ d }: { d: InstagramInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      {/* Caption analyzer */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Caption Lab</h3>
              <p className="text-xs text-muted-foreground mt-0.5">AI-rewritten captions for maximum engagement</p>
            </div>
            <ScoreBadge score={d.captionScore} />
          </div>
          <div className="space-y-3">
            {d.improvedCaptions.map((cap, i) => {
              const labels = ["Hook-first", "Storytelling", "Question-driven"];
              const colors2 = ["border-primary/30 bg-primary/8 text-primary", "border-fuchsia-500/30 bg-fuchsia-500/8 text-fuchsia-300", "border-accent/30 bg-accent/8 text-accent"];
              return (
                <div key={i} className="rounded-xl border border-white/10 bg-white/4 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", colors2[i % 3])}>
                      {labels[i % 3]}
                    </span>
                    <CopyButton text={cap} />
                  </div>
                  <p className="text-sm leading-relaxed">{cap}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Hashtag clusters */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Hashtag Intelligence</h3>
            </div>
            <ScoreBadge score={d.hashtagScore} />
          </div>
          <div className="space-y-3">
            {d.hashtagClusters.map((cluster: SocialHashtagCluster, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/4 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{cluster.name}</span>
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    cluster.strength === "high" ? "border-emerald-500/25 text-emerald-300" :
                    cluster.strength === "medium" ? "border-amber-500/25 text-amber-300" :
                    "border-rose-500/25 text-rose-300"
                  )}>
                    {cluster.strength}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cluster.hashtags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => navigator.clipboard.writeText(tag)}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Click any hashtag to copy it.</p>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function IGEngagementTab({ d }: { d: InstagramInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="font-semibold text-sm">Engagement Intelligence</h3>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3">
            {TREND_ICON(d.engagementTrend)}
            <div>
              <div className="text-sm font-semibold capitalize">{d.engagementTrend} engagement</div>
              <p className="text-xs text-muted-foreground">Based on general platform performance benchmarks for this niche</p>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-emerald-300">What's performing well</div>
            <div className="flex flex-wrap gap-2">
              {d.strongCategories.map((cat, i) => (
                <span key={i} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-primary">Actions to boost engagement</div>
            {d.engagementActions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/8 p-3 text-xs">
                <span className="shrink-0 font-black text-primary">{i + 1}</span>
                <span className="text-muted-foreground">{action}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── Facebook Deep-Dive Sections ─────────────────────────────────────────────

function FBBrandingTab({ d }: { d: FacebookInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="font-semibold text-sm">Page Branding Analysis</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-center space-y-2">
              <div className={cn("text-3xl font-black", SCORE_COLOR(d.pageTitleScore))}>{d.pageTitleScore}</div>
              <div className="text-xs text-muted-foreground">Page Title Score</div>
              <ScoreBar score={d.pageTitleScore} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-center space-y-2">
              <div className={cn("text-3xl font-black", SCORE_COLOR(d.pageDescScore))}>{d.pageDescScore}</div>
              <div className="text-xs text-muted-foreground">Description Score</div>
              <ScoreBar score={d.pageDescScore} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-primary">Branding improvements</div>
            {d.brandingImprovements.map((imp, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <span className="text-muted-foreground">{imp}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function FBContentTab({ d }: { d: FacebookInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="font-semibold text-sm">Content Strategy</h3>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
            <div className="text-xs font-semibold text-emerald-300 mb-1">Recommended posting frequency</div>
            <div className="text-sm font-bold">{d.recommendedFrequency}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold text-primary">Best content formats</div>
              <ul className="space-y-1.5">
                {d.bestFormats.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-accent">Top post types</div>
              <ul className="space-y-1.5">
                {d.topPostTypes.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </motion.div>
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-fuchsia-300" />
            <h3 className="font-semibold text-sm">Audience Engagement Strategy</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{d.interactionStrategy}</p>
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-fuchsia-300">Engagement opportunities</div>
            {d.engagementOpportunities.map((op, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-fuchsia-500/8 border border-fuchsia-500/15 px-3 py-2 text-xs">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fuchsia-300 mt-0.5" />
                <span className="text-muted-foreground">{op}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function RoadmapPhase({
  phase,
  label,
  color,
}: {
  phase: SocialRoadmapPhase;
  label: string;
  color: string;
}) {
  return (
    <Card className="space-y-3 p-5 glass">
      <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold", color)}>
        {label}
      </div>
      <div className="text-sm font-semibold">{phase.focus}</div>
      <ul className="space-y-1.5">
        {phase.actions.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 font-bold text-primary">{i + 1}.</span>
            <span className="text-muted-foreground">{a}</span>
          </li>
        ))}
      </ul>
      {phase.kpis && phase.kpis.length > 0 && (
        <div className="border-t border-white/8 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Target KPIs</div>
          <div className="flex flex-wrap gap-1.5">
            {phase.kpis.map((k, i) => (
              <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FBRoadmapTab({ d }: { d: FacebookInsights }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <RoadmapPhase
          phase={d.roadmap30}
          label="Days 1–30"
          color="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <RoadmapPhase
          phase={d.roadmap60}
          label="Days 31–60"
          color="border-amber-500/30 bg-amber-500/10 text-amber-300"
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <RoadmapPhase
          phase={d.roadmap90}
          label="Days 61–90"
          color="border-primary/30 bg-primary/10 text-primary"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Shared Overview Tab ─────────────────────────────────────────────────────

function OverviewTab({ data }: { data: SocialAnalysisResult }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
      {/* Score card */}
      <motion.div variants={fadeUp}>
        <Card className="relative overflow-hidden p-6 glass border-gradient">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex items-start gap-5">
            <div className={cn("grid h-20 w-20 shrink-0 place-items-center rounded-2xl border text-3xl font-black", SCORE_BG(data.overallScore), SCORE_COLOR(data.overallScore))}>
              {data.overallScore}
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-lg font-bold">{data.headline}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Category scores */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-4 p-5 glass">
          <h3 className="text-sm font-semibold">Score Breakdown</h3>
          <div className="space-y-4">
            {data.categories.map((cat, i) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <span className={cn("font-bold tabular-nums", SCORE_COLOR(cat.score))}>{cat.score}/100</span>
                </div>
                <ScoreBar score={cat.score} delay={i * 0.1} />
                <p className="text-xs text-muted-foreground">{cat.notes}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Quick wins */}
      <motion.div variants={fadeUp}>
        <Card className="space-y-3 p-5 glass">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold">Quick Wins — do these today</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.quickWins.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 p-3 text-xs">
                <span className="shrink-0 font-black text-amber-300">{i + 1}</span>
                <span className="text-muted-foreground">{w}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Strategies */}
      <motion.div variants={stagger(0.1)} className="grid gap-3 sm:grid-cols-2">
        {data.strategies.map((s, i) => (
          <motion.div key={i} variants={scaleIn}>
            <Card className="h-full space-y-3 p-5 glass hover:border-primary/30 transition-all">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">{s.title}</h4>
                <span className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1",
                  s.impact.toLowerCase() === "high"
                    ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                    : s.impact.toLowerCase() === "medium"
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", IMPACT_DOT[s.impact.toLowerCase()] || "bg-primary")} />
                  {s.impact}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
              <div className="space-y-1.5 border-t border-white/8 pt-2">
                {s.steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 font-bold text-primary">{j + 1}.</span>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-black", SCORE_BG(score), SCORE_COLOR(score))}>
      {score}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SocialAnalyzerPage() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const urlPlatform = (params.get("platform") as Platform) || "instagram";
  const urlHandle = params.get("handle") || "";

  const [platform, setPlatform] = useState<Platform>(urlPlatform);
  const [handle, setHandle] = useState(urlHandle);
  const [loadingStep, setLoadingStep] = useState(0);
  const [igTab, setIgTab] = useState<IGTab>("overview");
  const [fbTab, setFbTab] = useState<FBTab>("overview");
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const { toast } = useToast();
  const ai = useAiSettings();

  const analyze = useAnalyzeSocial();

  useEffect(() => {
    const p = params.get("platform") as Platform;
    const h = params.get("handle") || "";
    if (p && (p === "instagram" || p === "facebook")) setPlatform(p);
    if (h) setHandle(h);
  }, [searchStr]);

  useEffect(() => {
    if (urlHandle && !autoSubmitted && !analyze.isPending && !analyze.data) {
      setAutoSubmitted(true);
      analyze.mutate({
        data: {
          platform: urlPlatform,
          handle: urlHandle,
          personality: ai.aiPersonality,
          style: ai.aiStyle,
          depth: ai.aiDepth,
          creativity: ai.aiCreativity,
          focusAreas: ai.aiFocusAreas,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side watchdog: the backend aborts at 120s with a 504, but if the
  // connection truly stalls we still want to surface a timeout to the user.
  // This only notifies — the pending mutation resolves when the backend replies.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (analyze.isPending) {
      timeout = setTimeout(() => {
        toast({
          title: "Analysis is taking longer than usual",
          description: `${platform === "instagram" ? "Instagram" : "Facebook"} API request timed out. Please try again.`,
          variant: "destructive",
        });
      }, ANALYZE_TIMEOUT_MS);
    }
    return () => clearTimeout(timeout);
  }, [analyze.isPending]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (analyze.isPending) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((s) => (s < LOADING_STEPS.length - 1 ? s + 1 : s));
      }, 2200);
    }
    return () => clearInterval(interval);
  }, [analyze.isPending]);

  const run = async () => {
    const h = handle.trim().replace(/^@/, "");
    if (!h) return;
    analyze.mutate({
      data: {
        platform,
        handle: h,
        personality: ai.aiPersonality,
        style: ai.aiStyle,
        depth: ai.aiDepth,
        creativity: ai.aiCreativity,
        focusAreas: ai.aiFocusAreas,
      },
    });
  };

  const data = analyze.data;
  const ig = data?.instagramInsights;
  const fb = data?.facebookInsights;
  const plat = PLATFORMS.find((p) => p.id === platform)!;

  const IG_TABS = [
    { id: "overview" as IGTab, label: "Overview", icon: BarChart3 },
    { id: "profile" as IGTab, label: "Profile & Bio", icon: Eye },
    { id: "content" as IGTab, label: "Content & Reels", icon: Sparkles },
    { id: "captions" as IGTab, label: "Captions & Hashtags", icon: Hash },
    { id: "engagement" as IGTab, label: "Engagement", icon: MessageSquare },
  ];

  const FB_TABS = [
    { id: "overview" as FBTab, label: "Overview", icon: BarChart3 },
    { id: "branding" as FBTab, label: "Page Branding", icon: Target },
    { id: "content" as FBTab, label: "Content Strategy", icon: Sparkles },
    { id: "roadmap" as FBTab, label: "Growth Roadmap", icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Social Analyzer</h1>
            <p className="text-sm text-muted-foreground">
              AI intelligence engine for Instagram and Facebook profiles.
            </p>
          </div>
        </motion.div>

        {/* Platform selector */}
        <motion.div variants={fadeUp} className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPlatform(p.id);
                analyze.reset();
                setIgTab("overview");
                setFbTab("overview");
              }}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                platform === p.id
                  ? `${p.color} scale-[1.02] shadow-lg`
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              )}
            >
              <p.icon className="h-4 w-4" />
              {p.label}
              {platform === p.id && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          ))}
        </motion.div>

        {/* Search */}
        <motion.div variants={fadeUp} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder={plat.placeholder}
              className="h-12 pl-11 bg-white/4 border-white/10 focus:border-primary/40 text-base"
            />
          </div>
          <Button
            onClick={run}
            disabled={analyze.isPending || !handle.trim()}
            className="h-12 px-6 glow-primary font-semibold"
          >
            {analyze.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Analyze</>
            )}
          </Button>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-300/80">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              AI-estimated analysis using training knowledge of platform patterns — not live API data.
              AI personality is set to <span className="font-semibold capitalize">{ai.aiPersonality}</span>.
              Change in <a href="/settings" className="underline hover:text-amber-200">Settings</a>.
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Loading state */}
      {analyze.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="relative overflow-hidden p-8 glass">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
            </div>
            <div className="relative space-y-6 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Analyzing @{handle.replace(/^@/, "")}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-xs text-muted-foreground"
                  >
                    {LOADING_STEPS[loadingStep]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: "5%" }}
                  animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Error */}
      {analyze.error && !analyze.isPending && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {socialErrorToMessage(analyze.error, platform)}
        </Card>
      )}

      {/* Results */}
      {data && !analyze.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Platform header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold", plat.color)}>
              <plat.icon className="h-4 w-4" />@{data.handle}
            </div>
            <div className={cn("grid h-9 w-9 place-items-center rounded-xl border text-sm font-black", SCORE_BG(data.overallScore), SCORE_COLOR(data.overallScore))}>
              {data.overallScore}
            </div>
            <div className="ml-auto">
              <SocialDocxButton analysis={data} />
            </div>
          </div>

          {/* Instagram tabs */}
          {data.platform === "instagram" && ig && (
            <div className="space-y-4">
              <TabNav tabs={IG_TABS} active={igTab} onChange={(t) => setIgTab(t as IGTab)} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={igTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {igTab === "overview" && <OverviewTab data={data} />}
                  {igTab === "profile" && <IGProfileTab d={ig} />}
                  {igTab === "content" && <IGContentTab d={ig} />}
                  {igTab === "captions" && <IGCaptionsTab d={ig} />}
                  {igTab === "engagement" && <IGEngagementTab d={ig} />}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Facebook tabs */}
          {data.platform === "facebook" && fb && (
            <div className="space-y-4">
              <TabNav tabs={FB_TABS} active={fbTab} onChange={(t) => setFbTab(t as FBTab)} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={fbTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {fbTab === "overview" && <OverviewTab data={data} />}
                  {fbTab === "branding" && <FBBrandingTab d={fb} />}
                  {fbTab === "content" && <FBContentTab d={fb} />}
                  {fbTab === "roadmap" && <FBRoadmapTab d={fb} />}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-muted-foreground">
            <AlertTriangle className="inline-block mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {data.disclaimer}
          </div>
        </motion.div>
      )}
    </div>
  );
}
