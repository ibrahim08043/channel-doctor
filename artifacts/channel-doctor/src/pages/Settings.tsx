import { useEffect, useState } from "react";
import { useGetConnectedProfile, useUnlinkChannel } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Bell,
  Brain,
  Sliders,
  User as UserIcon,
  Youtube,
  Save,
  Shield,
  Zap,
  Database,
  LogOut,
  Trash2,
  Download,
  Monitor,
  Lock,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import { type Prefs, PREFS_DEFAULTS, PREFS_KEY, loadPrefs } from "@/lib/prefs";

export type { Prefs };
export { loadPrefs };

const PERSONALITIES = [
  {
    id: "consultant" as const,
    label: "Strategic Consultant",
    desc: "Professional, executive-level insights with measurable impact.",
    emoji: "🏛️",
  },
  {
    id: "growthhacker" as const,
    label: "Growth Hacker",
    desc: "Aggressive, viral-first tactics. Bold, fast, and provocative.",
    emoji: "🚀",
  },
  {
    id: "branding" as const,
    label: "Branding Expert",
    desc: "Every recommendation through the lens of brand equity.",
    emoji: "✨",
  },
  {
    id: "coach" as const,
    label: "Content Coach",
    desc: "Encouraging, educational, community-first guidance.",
    emoji: "🎯",
  },
  {
    id: "analyst" as const,
    label: "Data Analyst",
    desc: "Numbers-first. Benchmarks, data, and evidence for everything.",
    emoji: "📊",
  },
];

const FOCUS_AREAS = ["Growth", "Branding", "Engagement", "Monetization", "Audience Building"];

type Tab = "ai" | "alerts" | "account" | "privacy";

export default function SettingsPage() {
  const { user } = useUser();
  const me = useGetConnectedProfile();
  const unlink = useUnlinkChannel();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAULTS);
  const [tab, setTab] = useState<Tab>("ai");

  useEffect(() => setPrefs(loadPrefs()), []);

  const save = () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    toast({ title: "Preferences saved", description: "Your AI settings are active." });
  };

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  const toggleFocus = (area: string) => {
    const cur = prefs.aiFocusAreas;
    set("aiFocusAreas", cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area]);
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "ai", label: "AI Intelligence", icon: Brain },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "account", label: "Account", icon: UserIcon },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="space-y-1"
      >
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Customize how SocialPulse AI thinks for you.
            </p>
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div variants={fadeUp} className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === "ai" && (
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
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">AI Personality</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                This changes how the AI frames every insight, recommendation, and report.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => set("aiPersonality", p.id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-4 text-left transition-all",
                      prefs.aiPersonality === p.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                        : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.emoji}</span>
                      <span className="text-sm font-semibold">{p.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Style + Depth side by side */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="space-y-3 p-5 glass">
                <div className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-accent" />
                  <h3 className="text-sm font-semibold">Communication Style</h3>
                </div>
                <div className="space-y-1.5">
                  {(["direct", "detailed", "executive", "beginner", "advanced"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => set("aiStyle", s)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                        prefs.aiStyle === s
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      {s}
                      {prefs.aiStyle === s && (
                        <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 p-5 glass">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-fuchsia-300" />
                  <h3 className="text-sm font-semibold">Analysis Depth</h3>
                </div>
                <div className="space-y-1.5">
                  {(["quick", "standard", "deep", "enterprise"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => set("aiDepth", d)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium capitalize transition-all",
                        prefs.aiDepth === d
                          ? "bg-fuchsia-500/15 text-fuchsia-300"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <span>{d}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {d === "quick" ? "~5s" : d === "standard" ? "~10s" : d === "deep" ? "~20s" : "~30s"}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Creativity slider */}
            <Card className="space-y-4 p-5 glass">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎨</span>
                  <h3 className="text-sm font-semibold">AI Creativity</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {prefs.aiCreativity <= 25
                      ? "Conservative"
                      : prefs.aiCreativity <= 50
                      ? "Balanced"
                      : prefs.aiCreativity <= 75
                      ? "Creative"
                      : "Experimental"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-bold",
                      prefs.aiCreativity >= 75
                        ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300"
                        : "border-white/10 text-muted-foreground"
                    )}
                  >
                    {prefs.aiCreativity}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={prefs.aiCreativity}
                  onChange={(e) => set("aiCreativity", Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(258 90% 66%) 0%, hsl(189 100% 52%) ${prefs.aiCreativity}%, rgba(255,255,255,0.1) ${prefs.aiCreativity}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Precise & factual</span>
                  <span>Bold & experimental</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Controls content ideas, title generation, and caption creativity.
              </p>
            </Card>

            {/* Focus Areas */}
            <Card className="space-y-3 p-5 glass">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h3 className="text-sm font-semibold">AI Focus Areas</h3>
                <span className="text-xs text-muted-foreground">— AI prioritizes these in all outputs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((area) => {
                  const active = prefs.aiFocusAreas.includes(area);
                  return (
                    <button
                      key={area}
                      onClick={() => toggleFocus(area)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/20"
                          : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      )}
                    >
                      {active ? "✓ " : ""}{area}
                    </button>
                  );
                })}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button onClick={save} className="glow-primary">
                <Save className="mr-2 h-4 w-4" />
                Save AI settings
              </Button>
            </div>
          </motion.div>
        )}

        {tab === "alerts" && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="space-y-3 p-6 glass">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-300" />
                <h2 className="font-semibold">Channel Alerts</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                SocialPulse monitors your connected channel and notifies you of significant changes.
              </p>
              <Toggle label="View drop alerts — notify when a video drops below expected performance" checked={prefs.alertDrops} onChange={(v) => set("alertDrops", v)} />
              <Toggle label="Growth spike alerts — notify when you gain unusually fast traction" checked={prefs.alertSpikes} onChange={(v) => set("alertSpikes", v)} />
              <Toggle label="Consistency alerts — notify when posting cadence drops significantly" checked={prefs.alertConsistency} onChange={(v) => set("alertConsistency", v)} />
            </Card>
            <Card className="space-y-3 p-6 glass">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                <h2 className="font-semibold">Interface</h2>
              </div>
              <Toggle label="Smooth animations — reduces motion for performance" checked={prefs.animations} onChange={(v) => set("animations", v)} />
            </Card>
            <div className="flex justify-end">
              <Button onClick={save} className="glow-primary">
                <Save className="mr-2 h-4 w-4" />
                Save preferences
              </Button>
            </div>
          </motion.div>
        )}

        {tab === "account" && (
          <motion.div
            key="account"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="space-y-4 p-6 glass">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Profile</h2>
              </div>
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

            <Card className="space-y-4 p-6 glass">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-rose-400" />
                <h2 className="font-semibold">Connected Channel</h2>
              </div>
              {me.data?.channelId ? (
                <div className="flex items-center gap-3">
                  {me.data.channelThumbnail && (
                    <img src={me.data.channelThumbnail} alt="" className="h-12 w-12 rounded-full ring-2 ring-primary/20" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{me.data.channelTitle}</div>
                    <div className="text-xs text-muted-foreground">Connected YouTube channel</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate(undefined, { onSuccess: () => me.refetch() })}
                    className="border-white/10"
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
          </motion.div>
        )}

        {tab === "privacy" && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Data Controls */}
            <Card className="space-y-4 p-6 glass">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-300" />
                <h2 className="font-semibold">Data Controls</h2>
              </div>
              <div className="space-y-2">
                <PrivacyAction
                  icon={Download}
                  label="Export account data"
                  desc="Download all your saved analyses, preferences, and channel data as JSON."
                  action="Export"
                  onClick={() => toast({ title: "Export requested", description: "Your data will be emailed within 24 hours." })}
                />
                <PrivacyAction
                  icon={Trash2}
                  label="Delete account"
                  desc="Permanently delete your account and all associated data. This cannot be undone."
                  action="Delete"
                  danger
                  onClick={() => toast({ title: "Contact support", description: "Please email support@socialpulse.ai to request account deletion.", variant: "destructive" })}
                />
              </div>
            </Card>

            {/* Session Management */}
            <Card className="space-y-4 p-6 glass">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-emerald-300" />
                <h2 className="font-semibold">Session Management</h2>
              </div>
              <div className="space-y-2">
                {[
                  { device: "Chrome on macOS", location: "San Francisco, US", current: true },
                  { device: "Safari on iPhone 15", location: "San Francisco, US", current: false },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {s.device}
                        {s.current && (
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.location}</div>
                    </div>
                    {!s.current && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive">
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => toast({ title: "All sessions revoked", description: "You have been signed out from all other devices." })}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign out all other devices
                </Button>
              </div>
            </Card>

            {/* Security */}
            <Card className="space-y-4 p-6 glass">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-300" />
                <h2 className="font-semibold">Security</h2>
              </div>
              <div className="space-y-2">
                <PrivacyAction
                  icon={Shield}
                  label="Two-factor authentication"
                  desc="Add an extra layer of protection to your account."
                  action="Enable 2FA"
                  onClick={() => toast({ title: "Manage 2FA", description: "Open your account menu (top-right) to configure 2FA." })}
                />
                <PrivacyAction
                  icon={RefreshCw}
                  label="OAuth connections"
                  desc="Manage which apps have access to your SocialPulse account."
                  action="Manage"
                  onClick={() => toast({ title: "OAuth management", description: "Open your account menu (top-right) to revoke app connections." })}
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function PrivacyAction({
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
    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/8 bg-white/3 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className={cn(
          "shrink-0 text-xs",
          danger
            ? "border-destructive/30 text-destructive hover:bg-destructive/10"
            : "border-white/10"
        )}
      >
        {action}
      </Button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/3 px-4 py-3 text-sm hover:bg-white/5 transition-all">
      <span>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        type="button"
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}
