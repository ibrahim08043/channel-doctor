import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import {
  Zap,
  LayoutDashboard,
  BookmarkCheck,
  Sparkles,
  Calendar,
  Settings,
  User,
  Globe,
  Link2,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AiChatWidget from "@/components/AiChatWidget";
import ParticlesBackground from "@/components/ParticlesBackground";
import ProfileDropdown from "@/components/ProfileDropdown";
import NotificationCenter from "@/components/NotificationCenter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItem = (href: string, label: string, Icon: any) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
        location === href
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );

  const signedInNav = (
    <>
      {navItem("/dashboard", "Dashboard", LayoutDashboard)}
      {navItem("/connect", "Connect", Link2)}
      {navItem("/planner", "Planner", Calendar)}
      {navItem("/saved", "Saved", BookmarkCheck)}
      {navItem("/profile", "Profile", User)}
      {navItem("/settings", "Settings", Settings)}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      <ParticlesBackground />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <motion.span
              className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring" as const, stiffness: 300 }}
            >
              <Zap className="h-4 w-4 text-white" />
            </motion.span>
            <span className="text-gradient">SocialPulse</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              AI
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {navItem("/", "Analyzer", Sparkles)}
            {navItem("/social", "Social", Globe)}
            <SignedIn>{signedInNav}</SignedIn>
          </nav>

          <div className="flex items-center gap-2">
            <SignedOut>
              <Link href="/sign-in">
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="glow-primary">Get started</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <div className="hidden sm:block">
                <NotificationCenter />
              </div>
              <ProfileDropdown />
              <button
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle navigation menu"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground md:hidden"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </SignedIn>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.06] bg-background/95 backdrop-blur-xl md:hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
                {navItem("/", "Analyzer", Sparkles)}
                {navItem("/social", "Social", Globe)}
                <SignedIn>{signedInNav}</SignedIn>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <footer className="relative border-t border-white/[0.06] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-primary to-accent">
                <Zap className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-gradient">SocialPulse AI</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI growth OS for creators, brands, and agencies.
            </p>
          </div>
        </div>
      </footer>

      <SignedIn>
        {/* <AiChatWidget /> */}
      </SignedIn>
    </div>
  );
}
