import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useUser, useClerk } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Settings,
  Bell,
  CreditCard,
  LogOut,
  ChevronDown,
  Crown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useSocket } from "@/providers/SocketProvider";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/profile", label: "Profile", desc: "Your stats and achievements", icon: User },
  { href: "/settings", label: "Account settings", desc: "Preferences and connections", icon: Settings },
  { href: "/settings?tab=notifications", label: "Notifications", desc: "Alerts and delivery channels", icon: Bell },
  { href: "/settings?tab=account", label: "Billing", desc: "Plan and payment details", icon: CreditCard },
] as const;

export default function ProfileDropdown() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { unread, connection } = useSocket();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isLoaded || !user) return null;

  const name = user.fullName || user.username || "Creator";
  const email = user.primaryEmailAddress?.emailAddress || "";
  const avatar = user.imageUrl;

  const doSignOut = async () => {
    setSigningOut(true);
    await signOut({ redirectUrl: "/" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2 transition-all hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {avatar ? (
          <img src={avatar} alt={name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary">
            <User className="h-4 w-4" />
          </span>
        )}
        <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:block">{name}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header — avatar + identity */}
            <div className="border-b border-white/8 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt={name} className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/20 text-primary">
                    <User className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{name}</span>
                    <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  </div>
                  {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Free plan
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <nav className="p-1.5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isNotifs = item.href.includes("notifications");
                return (
                  <Link key={item.label} href={item.href} onClick={() => setOpen(false)}>
                    <div
                      role="menuitem"
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
                    >
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/5 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                        <Icon className="h-4 w-4" />
                        {isNotifs && unread > 0 && (
                          <span className="absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Footer — connection + sign out */}
            <div className="border-t border-white/8 p-2">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      connection === "connected" ? "bg-emerald-400" : connection === "connecting" ? "bg-amber-400" : "bg-muted-foreground",
                    )}
                  />
                  {connection === "connected" ? "Live" : connection === "connecting" ? "Connecting" : "Offline"}
                </span>
                <span className="text-[11px] text-muted-foreground/70">SocialPulse AI</span>
              </div>
              <button
                onClick={doSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {signingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
