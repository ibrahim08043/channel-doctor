import { useCallback, useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useGetConnectedProfile, useUnlinkChannel } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChannelAvatar from "@/components/ChannelAvatar";
import { ToggleRow, SectionHeader } from "@/components/settings/SettingsRows";
import {
  Settings as SettingsIcon,
  Bell,
  Brain,
  Sliders,
  User as UserIcon,
  Youtube,
  Save,
  Database,
  Zap,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Wifi,
  Mail,
  Monitor,
  Radio,
  TrendingUp,
  TrendingDown,
  Video,
  Eye,
  Clock,
  Sparkles,
  CreditCard,
  HardDrive,
  ShieldAlert,
  Users,
  PenLine,
  Search,
  Lightbulb,
  MessageSquare,
  FileBarChart,
  CalendarClock,
  GraduationCap,
  Image as ImageIcon,
  Send,
  BellRing,
  Facebook,
  Instagram,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import { useSettings } from "@/providers/SettingsProvider";
import { useSocket } from "@/providers/SocketProvider";
import type { UserSettings } from "@/lib/settings";

const PERSONALITIES = [
  { id: "consultant" as const, label: "Strategic Consultant", desc: "Professional, executive-level insights with measurable impact.", emoji: "🏛️" },
  { id: "growthhacker" as const, label: "Growth Hacker", desc: "Aggressive, viral-first tactics. Bold, fast, and provocative.", emoji: "🚀" },
  { id: "branding" as const, label: "Branding Expert", desc: "Every recommendation through the lens of brand equity.", emoji: "✨" },
  { id: "coach" as const, label: "Content Coach", desc: "Encouraging, educational, community-first guidance.", emoji: "🎯" },
  { id: "analyst" as const, label: "Data Analyst", desc: "Numbers-first. Benchmarks, data, and evidence for everything.", emoji: "📊" },
];

const FOCUS_AREAS = ["Growth", "Branding", "Engagement", "Monetization", "Audience Building"];

type Tab = "ai" | "alerts" | "notifications" | "account";

export default function SettingsPage() {
  const { user } = useUser();
  const me = useGetConnectedProfile();
  const unlink = useUnlinkChannel();
  const { toast } = useToast();
  const { settings, isLoading, isSaving, error, saveSettings, refresh } = useSettings();
  const { runAlertScan, sendTest } = useSocketActions();
  const searchStr = useSearch();

  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [tab, setTab] = useState<Tab>("ai");
  const [savedOnce, setSavedOnce] = useState(false);

  // Support ?tab=notifications / ?tab=account links (e.g. from the profile dropdown).
  useEffect(() => {
    const q = new URLSearchParams(searchStr).get("tab");
    if (q === "notifications" || q === "account" || q === "alerts" || q === "ai") {
      setTab(q);
    }
  }, [searchStr]);

  // Sync draft when server settings land (or refresh after a save).
  useEffect(() => {
    if (!isLoading) setDraft((d) => d ?? settings);
  }, [settings, isLoading]);

  const s = draft ?? settings;

  // ── Mutation helpers (all instantly optimistic + persisted) ───────────────
  const patchAI = useCallback((aiPatch: Partial<UserSettings["ai"]>) => {
    setDraft((d) => (d ? { ...d, ai: { ...d.ai, ...aiPatch } } : d));
    saveSettings({ ai: aiPatch }).catch(() => {});
  }, [saveSettings]);

  const patchProfile = useCallback((p: Partial<UserSettings["profile"]>) => {
    setDraft((d) => (d ? { ...d, profile: { ...d.profile, ...p } } : d));
    saveSettings({ profile: p }).catch(() => {});
  }, [saveSettings]);

  const patchAlerts = useCallback(
    <G extends "youtube" | "instagram" | "facebook" | "system">(
      group: G,
      key: keyof UserSettings["alerts"][G],
      value: boolean,
    ) => {
      setDraft((d) =>
        d ? { ...d, alerts: { ...d.alerts, [group]: { ...d.alerts[group], [key]: value } } } : d,
      );
      saveSettings({ alerts: { [group]: { [key]: value } } as any }).catch(() => {});
    },
    [saveSettings],
  );

  const patchChannels = useCallback((key: keyof UserSettings["notifications"]["channels"], value: boolean) => {
    setDraft((d) =>
      d
        ? { ...d, notifications: { ...d.notifications, channels: { ...d.notifications.channels, [key]: value } } }
        : d,
    );
    saveSettings({ notifications: { channels: { [key]: value } } as any }).catch(() => {});
  }, [saveSettings]);

  const onSave = async () => {
    if (!draft) return;
    try {
      await saveSettings(draft);
      setSavedOnce(true);
      toast({ title: "Settings saved", description: "Your preferences are live and synced to the database." });
    } catch {
      toast({ title: "Save failed", description: "Could not save settings. Please try again.", variant: "destructive" });
    }
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "ai", label: "AI Intelligence", icon: Brain },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "notifications", label: "Notifications", icon: BellRing },
    { id: "account", label: "Account", icon: UserIcon },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-1">
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Every change saves to the database and takes effect immediately.
            </p>
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div variants={fadeUp} className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/3 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Loading state */}
      {isLoading && !draft ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your settings…
        </Card>
      ) : error ? (
        <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Could not load settings
          </div>
          <p className="text-xs text-muted-foreground">{error.message}</p>
          <Button size="sm" variant="outline" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          {tab === "ai" && <AiTab s={s} patch={patchAI} patchProfile={patchProfile} />}
          {tab === "alerts" && <AlertsTab s={s} patch={patchAlerts} />}
          {tab === "notifications" && <NotificationsTab s={s} patchChannels={patchChannels} scan={runAlertScan} sendTest={sendTest} />}
          {tab === "account" && <AccountTab user={user} me={me} unlink={unlink} />}
        </AnimatePresence>
      )}

      {/* Sticky save bar */}
      {!isLoading && draft && tab !== "account" && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/90 p-3 shadow-2xl backdrop-blur-xl">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            {savedOnce ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> All changes synced to your account
              </>
            ) : (
              <>
                <Database className="h-4 w-4 text-primary" /> Changes save automatically
              </>
            )}
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="glow-primary flex-1 sm:flex-none"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hook bridging SocketProvider actions (avoids wiring props through tabs) ─

function useSocketActions() {
  const socket = useSocket();
  const { toast } = useToast();
  const runAlertScan = useCallback(async () => {
    try {
      await socket.runAlertScan();
      toast({ title: "Channel scan complete", description: "Checked your channel for new growth alerts." });
    } catch {
      toast({ title: "Scan failed", description: "Connect a channel first, then try again.", variant: "destructive" });
    }
  }, [socket, toast]);

  const sendTest = useCallback(async () => {
    try {
      const { sendTestNotification } = await import("@workspace/api-client-react");
      await sendTestNotification();
      toast({ title: "Test notification sent", description: "It should pop up in real time over the WebSocket." });
    } catch {
      toast({ title: "Could not send", description: "WebSocket unavailable.", variant: "destructive" });
    }
  }, [toast]);

  return { runAlertScan, sendTest };
}

// ── AI tab ─────────────────────────────────────────────────────────────────

function AiTab({
  s,
  patch,
  patchProfile,
}: {
  s: UserSettings;
  patch: (p: Partial<UserSettings["ai"]>) => void;
  patchProfile: (p: Partial<UserSettings["profile"]>) => void;
}) {
  const ai = s.ai;
  const p = s.profile;

  return (
    <motion.div
      key="ai"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* AI Personality */}
      <Card className="space-y-4 p-6 glass">
        <SectionHeader icon={Zap} title="AI Personality" subtitle="How the AI frames every insight, recommendation, and report." accent="border-primary/30 bg-primary/10 text-primary" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONALITIES.map((pers) => (
            <button
              key={pers.id}
              onClick={() => patch({ aiPersonality: pers.id })}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-4 text-left transition-all",
                ai.aiPersonality === pers.id
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                  : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{pers.emoji}</span>
                <span className="text-sm font-semibold">{pers.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{pers.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Style + Depth */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3 p-5 glass">
          <SectionHeader icon={Sliders} title="Communication Style" accent="border-accent/30 bg-accent/10 text-accent" />
          <div className="space-y-1.5">
            {(["direct", "detailed", "executive", "beginner", "advanced"] as const).map((style) => (
              <button
                key={style}
                onClick={() => patch({ aiStyle: style })}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                  ai.aiStyle === style ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {style}
                {ai.aiStyle === style && <div className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5 glass">
          <SectionHeader icon={Database} title="Analysis Depth" accent="border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" />
          <div className="space-y-1.5">
            {(["quick", "standard", "deep", "enterprise"] as const).map((depth) => (
              <button
                key={depth}
                onClick={() => patch({ aiDepth: depth })}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                  ai.aiDepth === depth ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <span>{depth}</span>
                <span className="text-[10px] text-muted-foreground">
                  {depth === "quick" ? "~5s" : depth === "standard" ? "~10s" : depth === "deep" ? "~20s" : "~30s"}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Creativity slider */}
      <Card className="space-y-4 p-5 glass">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Sparkles} title="AI Creativity" accent="border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" />
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-bold",
              ai.aiCreativity >= 75 ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/10 text-muted-foreground",
            )}
          >
            {ai.aiCreativity} · {ai.aiCreativity <= 25 ? "Conservative" : ai.aiCreativity <= 50 ? "Balanced" : ai.aiCreativity <= 75 ? "Creative" : "Experimental"}
          </span>
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={100}
            value={ai.aiCreativity}
            onChange={(e) => patch({ aiCreativity: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, hsl(258 90% 66%) 0%, hsl(189 100% 52%) ${ai.aiCreativity}%, rgba(255,255,255,0.1) ${ai.aiCreativity}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Precise & factual</span>
            <span>Bold & experimental</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Controls content ideas, title generation, and caption creativity.</p>
      </Card>

      {/* Response length + tone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3 p-5 glass">
          <SectionHeader icon={MessageSquare} title="Response Length" accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
          <div className="space-y-1.5">
            {(["concise", "balanced", "detailed"] as const).map((len) => (
              <button
                key={len}
                onClick={() => patch({ responseLength: len })}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                  ai.responseLength === len ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {len}
                {ai.responseLength === len && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5 glass">
          <SectionHeader icon={PenLine} title="AI Tone" accent="border-amber-500/30 bg-amber-500/10 text-amber-300" />
          <div className="space-y-1.5">
            {(["professional", "casual", "encouraging", "direct"] as const).map((tone) => (
              <button
                key={tone}
                onClick={() => patch({ tone })}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                  ai.tone === tone ? "bg-amber-500/15 text-amber-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {tone}
                {ai.tone === tone && <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Focus Areas */}
      <Card className="space-y-3 p-5 glass">
        <SectionHeader icon={Search} title="AI Focus Areas" subtitle="AI prioritizes these in all outputs" accent="border-primary/30 bg-primary/10 text-primary" />
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((area) => {
            const active = ai.aiFocusAreas.includes(area);
            return (
              <button
                key={area}
                onClick={() =>
                  patch({ aiFocusAreas: active ? ai.aiFocusAreas.filter((a) => a !== area) : [...ai.aiFocusAreas, area] })
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/20"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                {active ? "✓ " : ""}{area}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Automation */}
      <Card className="space-y-3 p-5 glass">
        <SectionHeader icon={Zap} title="AI Automation" subtitle="Let the AI work for you in the background" accent="border-accent/30 bg-accent/10 text-accent" />
        <div className="space-y-2">
          <ToggleRow
            icon={Lightbulb}
            label="Auto recommendations"
            description="Show personalized AI recommendations on your dashboard"
            checked={ai.autoRecommendations}
            onChange={(v) => patch({ autoRecommendations: v })}
          />
          <ToggleRow
            icon={Wand2}
            label="Auto optimization"
            description="Suggest title, thumbnail, and SEO improvements automatically"
            checked={ai.autoOptimization}
            onChange={(v) => patch({ autoOptimization: v })}
          />
          <ToggleRow
            icon={ActivityIcon}
            label="Auto analysis"
            description="Run channel analysis automatically on new uploads"
            checked={ai.autoAnalysis}
            onChange={(v) => patch({ autoAnalysis: v })}
          />
        </div>
      </Card>

      {/* Reporting */}
      <Card className="space-y-3 p-5 glass">
        <SectionHeader icon={FileBarChart} title="AI Reports" accent="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" />
        <div className="space-y-2">
          <ToggleRow
            icon={CalendarClock}
            label="Weekly AI reports"
            description="Get a weekly AI summary of your channel performance"
            checked={ai.weeklyReports}
            onChange={(v) => patch({ weeklyReports: v })}
          />
          <ToggleRow
            icon={FileBarChart}
            label="Monthly AI reports"
            description="Get a deep monthly growth and strategy report"
            checked={ai.monthlyReports}
            onChange={(v) => patch({ monthlyReports: v })}
          />
        </div>
      </Card>

      {/* Capabilities */}
      <Card className="space-y-3 p-5 glass">
        <SectionHeader icon={Brain} title="AI Capabilities" accent="border-primary/30 bg-primary/10 text-primary" />
        <div className="space-y-2">
          <ToggleRow
            icon={GraduationCap}
            label="AI learning mode"
            description="The AI learns your preferences from every interaction"
            checked={ai.learningMode}
            onChange={(v) => patch({ learningMode: v })}
          />
          <ToggleRow
            icon={Sparkles}
            label="Content suggestions"
            description="AI suggests new video ideas based on your niche"
            checked={ai.contentSuggestions}
            onChange={(v) => patch({ contentSuggestions: v })}
          />
          <ToggleRow
            icon={ImageIcon}
            label="Thumbnail suggestions"
            description="AI proposes high-CTR thumbnail concepts"
            checked={ai.thumbnailSuggestions}
            onChange={(v) => patch({ thumbnailSuggestions: v })}
          />
          <ToggleRow
            icon={Search}
            label="SEO suggestions"
            description="AI recommends keywords, tags, and descriptions"
            checked={ai.seoSuggestions}
            onChange={(v) => patch({ seoSuggestions: v })}
          />
          <ToggleRow
            icon={TrendingUp}
            label="AI trend detection"
            description="Spot rising topics and formats before they peak"
            checked={ai.trendDetection}
            onChange={(v) => patch({ trendDetection: v })}
          />
          <ToggleRow
            icon={LineChart}
            label="AI growth prediction"
            description="Forecast your subscriber and view growth"
            checked={ai.growthPrediction}
            onChange={(v) => patch({ growthPrediction: v })}
          />
        </div>
      </Card>

      {/* Appearance */}
      <Card className="space-y-3 p-5 glass">
        <SectionHeader icon={Monitor} title="Appearance" accent="border-white/20 bg-white/5 text-foreground" />
        <div className="space-y-2">
          <ToggleRow
            icon={Wifi}
            label="Smooth animations"
            description="Enable motion effects across the app"
            checked={p.animations}
            onChange={(v) => patchProfile({ animations: v })}
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ── Alerts tab ──────────────────────────────────────────────────────────────

type AlertGroup = "youtube" | "instagram" | "facebook" | "system";

const ALERT_GROUPS: {
  group: AlertGroup;
  title: string;
  subtitle: string;
  accent: string;
  icon: any;
  rows: { key: string; label: string; desc: string; icon: any }[];
}[] = [
  {
    group: "youtube",
    title: "YouTube Alerts",
    subtitle: "Growth & performance signals from your channel",
    accent: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    icon: Youtube,
    rows: [
      { key: "subscriberMilestones", label: "Subscriber milestone", desc: "Notify when you pass a subscriber milestone", icon: Users },
      { key: "subscriberDrop", label: "Sudden subscriber drop", desc: "Notify on unusual subscriber loss", icon: TrendingDown },
      { key: "videoPerformanceDrop", label: "Video performance drop", desc: "Notify when a video underperforms expectations", icon: Video },
      { key: "viralVideo", label: "Viral video detection", desc: "Notify when a video starts going viral", icon: TrendingUp },
      { key: "ctrDrop", label: "CTR drop", desc: "Notify when click-through rate drops", icon: Eye },
      { key: "retentionDrop", label: "Retention drop", desc: "Notify when audience retention falls", icon: Clock },
      { key: "lowImpressions", label: "Low impressions", desc: "Notify when impressions stay unusually low", icon: Video },
      { key: "monetization", label: "Monetization alerts", desc: "RPM, CPM, and revenue changes", icon: CreditCard },
      { key: "copyright", label: "Copyright alerts", desc: "Claims, strikes, and Content ID notices", icon: ShieldAlert },
      { key: "consistency", label: "Consistency alerts", desc: "Notify when posting cadence drops", icon: CalendarClock },
      { key: "growthSpike", label: "Growth spike alerts", desc: "Notify when you gain unusual traction", icon: TrendingUp },
    ],
  },
  {
    group: "instagram",
    title: "Instagram Alerts",
    subtitle: "Signals from your Instagram presence",
    accent: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
    icon: Instagram,
    rows: [
      { key: "followerSpike", label: "Follower spike", desc: "Notify on sudden follower growth", icon: TrendingUp },
      { key: "followerDrop", label: "Follower drop", desc: "Notify on unusual follower loss", icon: TrendingDown },
      { key: "viralReel", label: "Viral reel", desc: "Notify when a reel gains traction", icon: Video },
      { key: "engagementDrop", label: "Engagement drop", desc: "Notify when likes/comments decline", icon: MessageSquare },
    ],
  },
  {
    group: "facebook",
    title: "Facebook Alerts",
    subtitle: "Signals from your Facebook page",
    accent: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    icon: Facebook,
    rows: [
      { key: "postPerformance", label: "Post performance", desc: "Notify when posts underperform", icon: Video },
      { key: "pageGrowth", label: "Page growth", desc: "Notify on page follower changes", icon: TrendingUp },
      { key: "engagement", label: "Engagement", desc: "Notify on engagement declines", icon: MessageSquare },
    ],
  },
  {
    group: "system",
    title: "System Alerts",
    subtitle: "Account & infrastructure signals",
    accent: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: ShieldAlert,
    rows: [
      { key: "billing", label: "Billing alerts", desc: "Invoices, renewals, and payment failures", icon: CreditCard },
      { key: "aiQuota", label: "AI quota alerts", desc: "Notify when your AI usage approaches the limit", icon: Sparkles },
      { key: "storage", label: "Storage alerts", desc: "Saved reports and data storage warnings", icon: HardDrive },
      { key: "security", label: "Security alerts", desc: "New sign-ins and suspicious activity", icon: ShieldAlert },
    ],
  },
];

function AlertsTab({
  s,
  patch,
}: {
  s: UserSettings;
  patch: <G extends AlertGroup>(group: G, key: keyof UserSettings["alerts"][G], value: boolean) => void;
}) {
  return (
    <motion.div
      key="alerts"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {ALERT_GROUPS.map((g) => (
        <Card key={g.group} className="space-y-3 p-6 glass">
          <SectionHeader icon={g.icon} title={g.title} subtitle={g.subtitle} accent={g.accent} />
          <div className="space-y-2">
            {g.rows.map((row) => (
              <ToggleRow
                key={row.key}
                icon={row.icon}
                label={row.label}
                description={row.desc}
                checked={Boolean((s.alerts[g.group] as unknown as Record<string, boolean>)[row.key])}
                onChange={(v) => patch(g.group, row.key as keyof UserSettings["alerts"][typeof g.group], v)}
              />
            ))}
          </div>
        </Card>
      ))}

      {/* Live scan CTA */}
      <Card className="flex flex-col items-start justify-between gap-3 p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <RefreshCw className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Scan your channel now</h3>
            <p className="text-xs text-muted-foreground">
              Re-checks your channel against the alert rules above and pushes anything new to your notifications.
            </p>
          </div>
        </div>
        <ScanButton />
      </Card>
    </motion.div>
  );
}

function ScanButton() {
  const { runAlertScan } = useSocketActions();
  const [busy, setBusy] = useState(false);
  const doScan = async () => {
    setBusy(true);
    await runAlertScan();
    setBusy(false);
  };
  return (
    <Button variant="outline" size="sm" onClick={doScan} disabled={busy} className="shrink-0">
      {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
      {busy ? "Scanning…" : "Scan channel"}
    </Button>
  );
}

// ── Notifications tab ───────────────────────────────────────────────────────

function NotificationsTab({
  s,
  patchChannels,
  scan,
  sendTest,
}: {
  s: UserSettings;
  patchChannels: (key: keyof UserSettings["notifications"]["channels"], v: boolean) => void;
  scan: () => Promise<void>;
  sendTest: () => Promise<void>;
}) {
  const channels = s.notifications.channels;
  const { unread, notifications, connection, markAllRead } = useSocket();

  const CHANNEL_ROWS = [
    { key: "inApp" as const, label: "In-app notifications", desc: "Show alerts inside the app", icon: Bell },
    { key: "email" as const, label: "Email notifications", desc: "Send alerts to your inbox", icon: Mail },
    { key: "browser" as const, label: "Browser notifications", desc: "Desktop push when the app is open", icon: Monitor },
    { key: "realtime" as const, label: "Real-time notifications", desc: "Push instantly over WebSocket", icon: Radio },
  ];

  return (
    <motion.div
      key="notifications"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Delivery channels */}
      <Card className="space-y-3 p-6 glass">
        <SectionHeader icon={Send} title="Delivery Channels" subtitle="How notifications reach you" accent="border-primary/30 bg-primary/10 text-primary" />
        <div className="space-y-2">
          {CHANNEL_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              description={row.desc}
              checked={channels[row.key]}
              onChange={(v) => patchChannels(row.key, v)}
            />
          ))}
        </div>
      </Card>

      {/* Connection + test */}
      <Card className="space-y-3 p-6 glass">
        <SectionHeader icon={Radio} title="Real-time Connection" accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              connection === "connected"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : connection === "connecting"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/5 text-muted-foreground",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", connection === "connected" ? "bg-emerald-400" : connection === "connecting" ? "bg-amber-400" : "bg-muted-foreground")} />
            {connection === "connected" ? "Live — receiving real-time updates" : connection === "connecting" ? "Connecting…" : "Disconnected"}
          </span>
          <span className="text-xs text-muted-foreground">
            {unread} unread · {notifications.length} in history
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={sendTest}>
            <Send className="mr-2 h-3.5 w-3.5" /> Send test notification
          </Button>
          <Button size="sm" variant="outline" onClick={() => scan()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Scan for alerts
          </Button>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </Card>

      {/* Recent notifications preview */}
      <Card className="space-y-3 p-6 glass">
        <SectionHeader icon={Bell} title="Recent Notifications" accent="border-white/20 bg-white/5 text-foreground" />
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet. Run a scan or send a test to see them here.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-start gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.severity === "critical" ? "bg-rose-400" : n.severity === "warning" ? "bg-amber-400" : "bg-cyan-400")} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.body}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}

// ── Account tab ─────────────────────────────────────────────────────────────

function AccountTab({ user, me, unlink }: { user: ReturnType<typeof useUser>["user"]; me: any; unlink: any }) {
  const { toast } = useToast();
  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Profile */}
      <Card className="space-y-4 p-6 glass">
        <SectionHeader icon={UserIcon} title="Profile" accent="border-primary/30 bg-primary/10 text-primary" />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Name" value={user?.fullName || "—"} />
          <InfoRow label="Email" value={user?.primaryEmailAddress?.emailAddress || "—"} />
          <InfoRow label="Account ID" value={user?.id?.slice(0, 16) + "…" || "—"} />
          <InfoRow label="Joined" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} />
        </div>
        <p className="text-xs text-muted-foreground">
          Manage password, email and connected apps from the account menu (top-right avatar).
        </p>
      </Card>

      {/* Connected channel */}
      <Card className="space-y-4 p-6 glass">
        <SectionHeader icon={Youtube} title="Connected Channel" accent="border-rose-500/30 bg-rose-500/10 text-rose-300" />
        {me.data?.channelId ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {me.data.channelThumbnail && (
                <ChannelAvatar src={me.data.channelThumbnail} alt={me.data.channelTitle} className="h-12 w-12 shrink-0 rounded-full ring-2 ring-primary/20" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{me.data.channelTitle}</div>
                <div className="text-xs text-muted-foreground">Connected YouTube channel</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate(undefined, { onSuccess: () => me.refetch() })}
              className="border-white/10 sm:shrink-0"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No channel connected. Go to the Connect page to link your YouTube channel via Google.
          </p>
        )}
      </Card>

      {/* Data controls (actions only — no static data) */}
      <Card className="space-y-4 p-6 glass">
        <SectionHeader icon={Database} title="Data Controls" accent="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" />
        <div className="space-y-2">
          <ActionRow
            icon={Database}
            label="Export account data"
            desc="Download all your saved analyses, preferences, and channel data as JSON."
            action="Export"
            onClick={() => toast({ title: "Export requested", description: "Your data will be emailed within 24 hours." })}
          />
          <ActionRow
            icon={AlertTriangle}
            label="Delete account"
            desc="Permanently delete your account and all associated data. This cannot be undone."
            action="Delete"
            danger
            onClick={() => toast({ title: "Contact support", description: "Please email support@socialpulse.ai to request account deletion.", variant: "destructive" })}
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ── Small shared bits ───────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  desc,
  action,
  danger,
  onClick,
}: {
  icon: any;
  label: string;
  desc: string;
  action: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/8 bg-white/3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className={cn("shrink-0 text-xs sm:ml-auto", danger ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-white/10")}
      >
        {action}
      </Button>
    </div>
  );
}

// Icon aliases used above
const Wand2 = Sparkles;
const ActivityIcon = RefreshCw;
const LineChart = TrendingUp;
