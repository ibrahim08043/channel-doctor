import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Loader2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Video,
  Sparkles,
  ShieldAlert,
  CreditCard,
  HardDrive,
  Database,
  Newspaper,
} from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<
  string,
  { icon: typeof Info; chip: string; dot: string }
> = {
  critical: { icon: AlertCircle, chip: "border-rose-500/30 bg-rose-500/10 text-rose-300", dot: "bg-rose-400" },
  warning: { icon: AlertTriangle, chip: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  info: { icon: Info, chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", dot: "bg-cyan-400" },
};

const TYPE_ICONS: Record<string, typeof Info> = {
  subscriber_change: TrendingUp,
  subscriber_milestone: TrendingUp,
  subscriber_drop: TrendingDown,
  growth_spike: TrendingUp,
  follower_spike: TrendingUp,
  follower_drop: TrendingDown,
  viral_video: Zap,
  viral_reel: Zap,
  video_performance_drop: TrendingDown,
  ctr_drop: TrendingDown,
  retention_drop: Video,
  low_impressions: Video,
  engagement_drop: TrendingDown,
  consistency: Newspaper,
  monetization: CreditCard,
  copyright: ShieldAlert,
  billing: CreditCard,
  ai_quota: Sparkles,
  storage: HardDrive,
  security: ShieldAlert,
  ai_completed: Sparkles,
  analysis_completed: Sparkles,
  optimization_completed: Sparkles,
  report_generated: Database,
  system: Bell,
  test: Zap,
};

function typeIcon(type: string): typeof Info {
  return TYPE_ICONS[type] ?? Bell;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationCenter() {
  const {
    unread,
    notifications,
    isHistoryLoading,
    connection,
    runAlertScan,
    markRead,
    markAllRead,
    removeNotification,
    refreshUnread,
  } = useSocket();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const doScan = async () => {
    setScanning(true);
    try {
      await runAlertScan();
      toast({ title: "Channel scan complete", description: "Checked for new growth alerts." });
    } catch {
      toast({ title: "Scan failed", description: "Make sure your channel is connected.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const connected = connection === "connected";

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refreshUnread();
        }}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {/* Live connection indicator */}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
            connected ? "bg-emerald-400" : connection === "connecting" ? "bg-amber-400" : "bg-muted-foreground",
          )}
          title={connected ? "Live updates connected" : "Real-time disconnected"}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-12 z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Notifications</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={doScan}
                  disabled={scanning}
                  title="Scan your channel for growth alerts"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={markAllRead}
                  disabled={unread === 0}
                  title="Mark all as read"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isHistoryLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="space-y-2 px-6 py-10 text-center">
                  <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No notifications yet</p>
                  <p className="text-xs text-muted-foreground">
                    Connect a channel and run a scan to get growth alerts.
                  </p>
                  <button
                    onClick={doScan}
                    disabled={scanning}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Scan channel
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {notifications.map((n) => {
                    const sev = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
                    const Icon = typeIcon(n.type);
                    return (
                      <li key={n.id} className={cn("relative flex gap-3 px-4 py-3 transition-colors", n.read ? "opacity-70" : "bg-primary/5")}>
                        <span
                          className={cn(
                            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                            sev.chip,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">{n.title}</p>
                            {!n.read && <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", sev.dot)} />}
                          </div>
                          {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>}
                          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={() => removeNotification(n.id)}
                            title="Delete"
                            className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {!n.read && (
                            <button
                              onClick={() => markRead(n.id)}
                              title="Mark as read"
                              className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-white/5 hover:text-foreground"
                            >
                              <CheckCheck className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-400" : "bg-muted-foreground")} />
                {connected ? "Live updates active" : "Real-time disconnected"}
              </span>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-muted-foreground/70 transition-colors hover:text-primary">
                  Mark all read
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
