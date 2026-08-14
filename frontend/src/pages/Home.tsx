import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useSearchChannels, useGetChannel } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Sparkles, Loader2, Brain, Eye,
  BarChart3, Zap, Target, Users, TrendingUp, Lightbulb,
  CheckCircle2, Activity, Instagram, Facebook, Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ChannelAvatar from "@/components/ChannelAvatar";
import { compactNumber } from "@/lib/format";
import { fadeUp, stagger, scaleIn } from "@/lib/motion";

const DEMO_ID = "UCX6OQ3DkcsbYNE6H8uQQuVA";

type HomePlatform = "youtube" | "instagram" | "facebook";

const HOME_PLATFORMS: { id: HomePlatform; label: string; icon: typeof Youtube; placeholder: string; color: string }[] = [
  { id: "youtube", label: "YouTube", icon: Youtube, placeholder: "Channel name, @handle, or URL…", color: "platform-youtube" },
  { id: "instagram", label: "Instagram", icon: Instagram, placeholder: "@username or profile URL…", color: "platform-instagram" },
  { id: "facebook", label: "Facebook", icon: Facebook, placeholder: "Page name or @handle…", color: "platform-facebook" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [platform, setPlatform] = useState<HomePlatform>("youtube");
  const [, setLocation] = useLocation();

  const { data, isFetching, error } = useSearchChannels(
    { q: submitted },
    { query: { enabled: !!submitted && platform === "youtube" } as any }
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (platform === "instagram" || platform === "facebook") {
      const h = query.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^https?:\/\/(www\.)?facebook\.com\//i, "").replace(/\/$/, "");
      setLocation(`/social?platform=${platform}&handle=${encodeURIComponent(h)}`);
      return;
    }
    setSubmitted(query.trim());
  };

  return (
    <div className="space-y-24">
      {/* HERO */}
      <section className="relative min-h-[80vh] overflow-hidden flex items-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gradient-to-b from-primary/25 via-primary/10 to-transparent blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[300px] w-[400px] rounded-full bg-accent/12 blur-3xl" />
        </div>

        <div className="relative z-10 grid w-full gap-12 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <motion.div
            variants={stagger(0.1)}
            initial="hidden"
            animate="show"
            className="space-y-7"
          >
            <motion.div variants={fadeUp}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                AI Growth OS for Creators &amp; Brands
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Grow every<br />
              <span className="text-gradient">social channel</span><br />
              with AI.
            </motion.h1>

            <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Analyze YouTube, Instagram, and Facebook. Get AI-powered diagnoses,
              per-post breakdowns, competitor intel, growth forecasts, and a
              personal AI coach — all in one OS.
            </motion.p>

            {/* Platform tabs */}
            <motion.div variants={fadeUp} className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1 w-fit">
              {HOME_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPlatform(p.id); setQuery(""); setSubmitted(""); }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    platform === p.id
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p.icon className="h-3.5 w-3.5" />
                  {p.label}
                </button>
              ))}
            </motion.div>

            <motion.form variants={fadeUp} onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={HOME_PLATFORMS.find((p) => p.id === platform)?.placeholder ?? ""}
                  className="h-13 border-white/10 bg-white/5 pl-11 text-base backdrop-blur-sm focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
              <Button type="submit" size="lg" className="h-13 px-7 glow-primary font-semibold">
                Analyze <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.form>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
              {[
                { icon: CheckCircle2, label: "Real YouTube data" },
                { icon: CheckCircle2, label: "No credit card" },
                { icon: CheckCircle2, label: "Free analyzer" },
              ].map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5">
                  <b.icon className="h-3.5 w-3.5 text-emerald-400" /> {b.label}
                </span>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Platforms:</span>
              <Link href="/social?platform=youtube" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium platform-youtube hover-elevate">
                <Youtube className="h-3 w-3" /> YouTube
              </Link>
              <Link href="/social?platform=instagram" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium platform-instagram hover-elevate">
                <Instagram className="h-3 w-3" /> Instagram
              </Link>
              <Link href="/social?platform=facebook" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium platform-facebook hover-elevate">
                <Facebook className="h-3 w-3" /> Facebook
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3 } as any}
          >
            <DemoCard />
          </motion.div>
        </div>
      </section>

      {/* SEARCH RESULTS */}
      {submitted && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Results for <span className="text-primary">"{submitted}"</span>
            </h2>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {error && (
            <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
              Failed to search. {(error as Error).message}
            </Card>
          )}
          {!isFetching && data && data.results.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No channels found.</Card>
          )}
          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {data?.results.map((c) => (
              <motion.div key={c.id} variants={fadeUp}>
                <Link href={`/channel/${c.id}`}>
                  <Card className="group flex h-full items-start gap-4 p-4 glass transition-all hover:border-primary/40 hover:glow-primary hover-elevate cursor-pointer">
                    <ChannelAvatar src={c.thumbnail} alt={c.title} className="h-14 w-14 rounded-full border border-white/10" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate text-sm font-semibold">{c.title}</div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{c.description || "—"}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* HOW IT WORKS */}
      <section className="space-y-10">
        <SectionHeading eyebrow="How it works" title="From zero to growth strategy in 60 seconds" />
        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-4 md:grid-cols-3"
        >
          {[
            { n: "01", title: "Pick a platform & profile", body: "YouTube, Instagram, or Facebook. Drop a handle or search by name.", icon: Search },
            { n: "02", title: "Run the AI diagnosis", body: "We score content quality, consistency, engagement, growth potential, and branding.", icon: Brain },
            { n: "03", title: "Execute the playbook", body: "Prioritized actions, content calendar, title rewrites, competitor gaps, and a 30-day forecast.", icon: TrendingUp },
          ].map((s) => (
            <motion.div key={s.n} variants={fadeUp}>
              <Card className="relative space-y-3 overflow-hidden p-6 glass hover:border-primary/30 transition-all">
                <div className="absolute right-4 top-4 text-6xl font-black text-primary/8">{s.n}</div>
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* AI CAPABILITIES */}
      <section className="space-y-10">
        <SectionHeading eyebrow="AI capabilities" title="Eight tools. One growth OS." />
        <motion.div
          variants={stagger(0.07)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { icon: Brain, title: "AI Diagnosis", body: "Brutally honest health score with strengths, weaknesses & next actions.", accent: "text-primary" },
            { icon: Zap, title: "Title Optimizer", body: "10 high-CTR alternatives with click-score & reasoning.", accent: "text-amber-300" },
            { icon: Eye, title: "Thumbnail A/B", body: "Vision AI compares thumbnails and picks the winner.", accent: "text-cyan-300" },
            { icon: BarChart3, title: "Retention Mapper", body: "Predict the drop curve before you publish.", accent: "text-emerald-300" },
            { icon: Users, title: "Competitor Intel", body: "Find similar channels and see exactly where you're losing.", accent: "text-fuchsia-300" },
            { icon: Lightbulb, title: "Idea Engine", body: "Endless search-worthy ideas in your niche.", accent: "text-rose-300" },
            { icon: Target, title: "Why It Failed", body: "Forensic post-mortem on flops with concrete fixes.", accent: "text-orange-300" },
            { icon: TrendingUp, title: "30-day Forecast", body: "Realistic projections + growth drivers and risks.", accent: "text-teal-300" },
          ].map((f) => (
            <motion.div key={f.title} variants={scaleIn}>
              <Card className="group h-full cursor-default space-y-3 p-5 glass transition-all hover:border-primary/30 hover:-translate-y-1">
                <div className={`grid h-9 w-9 place-items-center rounded-lg bg-white/5 ${f.accent}`}>
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="font-semibold text-sm">{f.title}</div>
                <p className="text-xs text-muted-foreground">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* PLATFORM CARDS */}
      <section className="space-y-10">
        <SectionHeading eyebrow="Supported platforms" title="YouTube, Instagram, and Facebook" subtitle="TikTok, X, and LinkedIn coming soon." />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Youtube, label: "YouTube", color: "platform-youtube",
              features: ["Per-video AI scoring", "Competitor comparison", "30-day forecast", "Content planner"],
              href: "/",
            },
            {
              icon: Instagram, label: "Instagram", color: "platform-instagram",
              features: ["Profile growth score", "Engagement analysis", "Reel performance", "Hashtag strategy"],
              href: "/social?platform=instagram",
            },
            {
              icon: Facebook, label: "Facebook", color: "platform-facebook",
              features: ["Page performance", "Content engagement", "Posting frequency", "Audience insights"],
              href: "/social?platform=facebook",
            },
          ].map((p) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Link href={p.href}>
                <Card className={`group h-full cursor-pointer space-y-4 p-6 glass border transition-all hover:-translate-y-1 hover:border-current ${p.color}`}>
                  <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${p.color}`}>
                    <p.icon className="h-4 w-4" /> {p.label}
                  </div>
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    Analyze now <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl p-12 text-center border-gradient"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[200px] w-[300px] rounded-full bg-accent/15 blur-3xl" />
        </div>
        <div className="relative space-y-5">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-black sm:text-5xl"
          >
            Stop guessing.<br /><span className="text-gradient">Start growing.</span>
          </motion.h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Connect your channel for daily alerts, a 7-day content plan, and a personal AI growth coach.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="glow-primary font-semibold">Get started free <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-white/10 hover:border-primary/40">Open dashboard</Button>
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{eyebrow}</div>
      <h2 className="text-3xl font-black sm:text-4xl">{title}</h2>
      {subtitle && <p className="mx-auto max-w-lg text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function DemoCard() {
  const { data, isLoading } = useGetChannel(DEMO_ID);
  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/40 to-accent/30 blur-2xl opacity-30" />
      <motion.div
        className="relative glass-strong rounded-2xl p-5 space-y-4"
        whileHover={{ y: -4 }}
        transition={{ type: "spring" as const, stiffness: 200 }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE DEMO
          </span>
          <span className="text-muted-foreground">Real YouTube data</span>
        </div>

        {isLoading || !data ? (
          <div className="space-y-3">
            {[14, 12, 8, 24].map((w) => (
              <div key={w} className={`h-${w} animate-pulse rounded-lg bg-white/5`} />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ChannelAvatar src={data.thumbnail} alt={data.title} className="h-12 w-12 rounded-full ring-2 ring-primary/30" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{data.title}</div>
                <div className="text-xs text-muted-foreground">
                  {compactNumber(data.subscriberCount)} subscribers · {compactNumber(data.viewCount)} views
                </div>
              </div>
              <div className={`grid h-12 w-12 place-items-center rounded-full ring-2 ${data.healthScore >= 70 ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/15 text-amber-300 ring-amber-500/30"}`}>
                <span className="text-sm font-bold">{data.healthScore}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <MiniStat label="Avg views" value={compactNumber(data.avgViews)} />
              <MiniStat label="Engagement" value={(data.engagementRate * 100).toFixed(1) + "%"} />
              <MiniStat label="Uploads/wk" value={data?.uploadCadencePerWeek?.toFixed(1)} />
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/8 p-3 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 text-primary font-medium">
                <Activity className="h-3.5 w-3.5" /> AI verdict
              </div>
              <p className="text-muted-foreground line-clamp-3">
                Dominant channel with consistent viral reach. Engagement is healthy relative to subscriber count.
                Focus on posting-window optimization to capture off-peak audiences.
              </p>
            </div>
            <Link href={`/channel/${DEMO_ID}`}>
              <Button size="sm" className="w-full h-8 text-xs glow-primary">Full analysis →</Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/4 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
