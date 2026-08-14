import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useGetConnectedProfile } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChannelAvatar from "@/components/ChannelAvatar";
import {
  Loader2, Youtube, Check, ArrowRight, ShieldCheck,
  AlertCircle, RefreshCw, Search, Copy, CheckCheck,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

type Phase =
  | { id: "init" }
  | { id: "checking" }
  | { id: "ready" }
  | { id: "starting_oauth" }
  | { id: "looking_up" }
  | { id: "preview"; channelId: string; channelTitle: string; channelThumbnail: string | null }
  | { id: "linking"; channelId: string; channelTitle: string; channelThumbnail: string | null }
  | { id: "success"; channelTitle: string; channelThumbnail: string | null }
  | { id: "error"; message: string; raw?: string };

interface CheckResult {
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  youtubeApiKeyConfigured: boolean;
  callbackUri: string;
  allConfigured: boolean;
}

export default function ConnectPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <>
      <SignedOut>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SignedOut>
      <SignedIn>
        <ConnectInner />
      </SignedIn>
    </>
  );
}

function ConnectInner() {
  const [, setLocation] = useLocation();
  const { user, isLoaded: userLoaded } = useUser();
  const me = useGetConnectedProfile();
  const [phase, setPhase] = useState<Phase>({ id: "init" });
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const didInitRef = useRef(false);

  // Read URL params ONCE on mount (set by backend after OAuth callback)
  const urlParams = new URLSearchParams(window.location.search);
  const successParam = urlParams.get("youtube_success");
  const errorParam = urlParams.get("youtube_error");
  const channelTitleParam = urlParams.get("channel_title");

  // ── Fetch credential/config status ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/youtube-oauth/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCheck(d as CheckResult))
      .catch(() => {});
  }, []);

  // ── Auto-detect: check DB for stored tokens ──────────────────────────────
  const runAutoDetect = async () => {
    try {
      const resp = await fetch("/api/connected/auto-detect-youtube", {
        method: "POST",
        credentials: "include",
      });
      const result = (await resp.json().catch(() => ({}))) as Record<string, any>;
      return result.channelId ? result : null;
    } catch {
      return null;
    }
  };

  // ── On mount: handle OAuth result or run auto-detect ────────────────────
  useEffect(() => {
    if (!userLoaded || !user || didInitRef.current) return;
    didInitRef.current = true;

    // Clean up URL params immediately
    if (successParam || errorParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Case 1: Backend callback signaled success — this page may be the POPUP.
    // If opened via window.open(), notify the opener and close ourselves.
    if (successParam === "1") {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            { type: "youtube_oauth_success", channelTitle: channelTitleParam ?? "Your channel" },
            window.location.origin
          );
        } catch {
          // cross-origin opener — ignore
        }
        window.close();
        return;
      }
      // Not a popup — normal flow (same-window fallback or direct URL visit)
      me.refetch().then(() => {
        setPhase({
          id: "success",
          channelTitle: channelTitleParam ?? "Your channel",
          channelThumbnail: null,
        });
      });
      return;
    }

    // Case 2: Backend callback signaled error
    if (errorParam) {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            { type: "youtube_oauth_error", error: errorParam },
            window.location.origin
          );
        } catch {
          // ignore
        }
        window.close();
        return;
      }
      setPhase({
        id: "error",
        message: decodeErrorParam(errorParam),
        raw: errorParam,
      });
      return;
    }

    // Case 3: Already connected (from DB / React Query cache)
    if (me.data?.channelId) {
      setPhase({
        id: "success",
        channelTitle: me.data.channelTitle ?? "Your channel",
        channelThumbnail: me.data.channelThumbnail ?? null,
      });
      return;
    }

    // Case 4: Try auto-detect with stored refresh tokens
    setPhase({ id: "checking" });
    runAutoDetect().then((result) => {
      if (result?.channelId) {
        me.refetch();
        setPhase({
          id: "success",
          channelTitle: result.channelTitle ?? "Your channel",
          channelThumbnail: result.channelThumbnail ?? null,
        });
      } else {
        setPhase({ id: "ready" });
      }
    });
  }, [userLoaded, user]);

  // ── Listen for popup postMessage (OAuth completed in popup window) ────────
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; channelTitle?: string; error?: string };
      if (data?.type === "youtube_oauth_success") {
        me.refetch().then(() => {
          setPhase({
            id: "success",
            channelTitle: data.channelTitle ?? "Your channel",
            channelThumbnail: null,
          });
        });
      } else if (data?.type === "youtube_oauth_error") {
        setPhase({
          id: "error",
          message: decodeErrorParam(data.error ?? "unknown"),
          raw: data.error,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // ── Start YouTube OAuth ──────────────────────────────────────────────────
  // Navigates to the BACKEND's OAuth start endpoint (VITE_API_ORIGIN, which is
  // http://localhost:8080 in dev) so the Google callback URI computed by the
  // server matches the one registered in Google Cloud Console:
  //   http://localhost:8080/api/youtube-oauth/callback
  // returnUrl points back at the FRONTEND /connect page, where the backend
  // redirects the user after consent with ?youtube_success=1.
  const handleConnectYouTube = () => {
    const apiOrigin = import.meta.env.VITE_API_ORIGIN || window.location.origin;
    const returnUrl = encodeURIComponent(
      `${window.location.origin}${base}/connect`
    );
    const oauthUrl = `${apiOrigin}/api/youtube-oauth/start?returnUrl=${returnUrl}`;

    console.log("Current origin:", window.location.origin);
    console.log("OAuth URL:", oauthUrl);

    setPhase({ id: "starting_oauth" });
    window.location.href = oauthUrl;
  };

  // ── Manual channel lookup ────────────────────────────────────────────────
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = manualInput.trim();
    if (!input) return;
    setPhase({ id: "looking_up" });
    try {
      const resp = await fetch("/api/connected/lookup-channel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const result = (await resp.json().catch(() => ({}))) as Record<string, any>;
      if (result.channelId) {
        setPhase({ id: "preview", channelId: result.channelId, channelTitle: result.channelTitle, channelThumbnail: result.channelThumbnail ?? null });
      } else {
        setPhase({ id: "ready" });
        setShowManual(true);
      }
    } catch {
      setPhase({ id: "ready" });
      setShowManual(true);
    }
  };

  const handleConfirmLink = async (channelId: string, channelTitle: string, channelThumbnail: string | null) => {
    setPhase({ id: "linking", channelId, channelTitle, channelThumbnail });
    try {
      const resp = await fetch("/api/connected/link-channel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, channelTitle, channelThumbnail }),
      });
      const result = (await resp.json().catch(() => ({}))) as Record<string, any>;
      if (result.error) {
        setPhase({ id: "error", message: result.message ?? "Failed to save channel." });
        return;
      }
      setPhase({ id: "success", channelTitle, channelThumbnail });
      me.refetch();
    } catch {
      setPhase({ id: "error", message: "Network error. Please try again." });
    }
  };

  const copyCallbackUri = () => {
    const uri = check?.callbackUri ?? "";
    navigator.clipboard.writeText(uri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Already connected ────────────────────────────────────────────────────
  // Only show this AFTER auto-detect has finished (not during init/checking).
  // During those phases, channelId in me.data may be stale cache — let
  // auto-detect run first so it can confirm or re-detect the channel.
  const autoDetectSettled = phase.id !== "init" && phase.id !== "checking";
  if (autoDetectSettled && ((me.data?.channelId && phase.id !== "success") ||
      (phase.id === "success" && me.data?.channelId))) {
    const title = phase.id === "success" ? phase.channelTitle : (me.data?.channelTitle ?? "Your channel");
    const thumb = phase.id === "success" ? phase.channelThumbnail : (me.data?.channelThumbnail ?? null);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg py-16 text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
          <Check className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black">YouTube channel connected!</h1>
          <p className="text-muted-foreground">{title}</p>
        </div>
        {thumb && <ChannelAvatar src={thumb} alt={title} className="mx-auto h-20 w-20 rounded-full ring-2 ring-primary/30" />}
        <div className="flex justify-center gap-3">
          <Button onClick={() => setLocation("/dashboard")} className="glow-primary">
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="border-white/10" onClick={() => setLocation("/settings")}>Manage</Button>
        </div>
      </motion.div>
    );
  }

  // ── Success (before me.data refreshes) ──────────────────────────────────
  if (phase.id === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg py-16 text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
          <Check className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black">YouTube channel connected!</h1>
          <p className="text-muted-foreground">{phase.channelTitle}</p>
        </div>
        <Button onClick={() => setLocation("/dashboard")} className="glow-primary">
          Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  // ── Loading / working ────────────────────────────────────────────────────
  if (phase.id === "init" || phase.id === "checking" || phase.id === "starting_oauth" || phase.id === "linking") {
    const labels: Record<string, string> = {
      init: "Loading…",
      checking: "Checking for existing YouTube connection…",
      starting_oauth: "Opening Google authorization…",
      linking: "Saving channel…",
    };
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mx-auto max-w-lg py-20 text-center space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <h2 className="text-xl font-bold">{labels[phase.id] ?? "Working…"}</h2>
        {(phase as any).id === "starting_oauth" && (
          <p className="text-sm text-muted-foreground">
            Redirecting you to Google to grant YouTube access, then bringing you right back.
          </p>
        )}
      </motion.div>
    );
  }

  // ── Channel preview ──────────────────────────────────────────────────────
  if (phase.id === "preview") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg py-10 space-y-6">
        <h1 className="text-2xl font-black">Is this your channel?</h1>
        <Card className="p-5 glass">
          <div className="flex items-center gap-4">
            {phase.channelThumbnail ? (
              <ChannelAvatar src={phase.channelThumbnail} alt={phase.channelTitle} className="h-16 w-16 rounded-full ring-2 ring-primary/30 shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-white/5 ring-2 ring-white/10 shrink-0 grid place-items-center">
                <Youtube className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-lg truncate">{phase.channelTitle}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{phase.channelId}</p>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-2">
          <Button className="glow-primary" size="lg" onClick={() => handleConfirmLink(phase.channelId, phase.channelTitle, phase.channelThumbnail)}>
            <Check className="mr-2 h-4 w-4" /> Yes, connect this channel
          </Button>
          <Button variant="outline" className="border-white/10" onClick={() => { setManualInput(""); setPhase({ id: "ready" }); }}>
            Not my channel — try again
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── Main ready / error page ──────────────────────────────────────────────
  const errorMessage = phase.id === "error" ? phase.message : null;
  const credMissing = check && !check.allConfigured;

  return (
      <div className="mx-auto max-w-xl space-y-5">

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/8 px-3 py-1.5 text-xs font-medium text-rose-300">
            <Youtube className="h-3.5 w-3.5" /> Connect YouTube Channel
          </div>
          <h1 className="text-3xl font-black">Connect your YouTube channel</h1>
          <p className="text-muted-foreground">
            Grant read-only access so Channel Doctor can analyze your growth.
          </p>
        </div>

        {/* ── Error banner ── */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-2 min-w-0">
              <p className="text-sm font-medium text-destructive">Connection failed</p>
              <p className="text-sm text-destructive/80 break-all">{errorMessage}</p>
              {(phase as any).raw === "access_denied" && (
                <p className="text-xs text-muted-foreground">You clicked "Deny" on Google's consent screen. Click the button below and grant access when prompted.</p>
              )}
              <Button size="sm" variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setPhase({ id: "ready" })}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </div>
        )}

        {/* ── Credential warning ── */}
        {credMissing && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-amber-300">Server credentials not fully configured</p>
              <p className="text-amber-300/70">
                {!check!.clientIdConfigured && "GOOGLE_CLIENT_ID is missing. "}
                {!check!.clientSecretConfigured && "GOOGLE_CLIENT_SECRET is missing. "}
                Add them to your Replit secrets and restart the API server.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 0: Register redirect URI ── */}
        <div>
          <Card className="p-5 glass space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => setShowSetupGuide(v => !v)}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">1</span>
                Register the redirect URI in Google Cloud Console
              </div>
              {showSetupGuide ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
              {showSetupGuide && (
                <motion.div
                  key="guide"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pt-1"
                >
                  <p className="text-sm text-muted-foreground">
                    In <strong className="text-foreground">Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client → Authorized redirect URIs</strong>, add this exact URL:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono break-all text-emerald-300 min-w-0">
                      {check?.callbackUri ?? "Loading…"}
                    </code>
                    <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 border border-white/10"
                      onClick={copyCallbackUri} disabled={!check?.callbackUri}>
                      {copied ? <CheckCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p>Also confirm in Google Cloud Console:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="text-foreground">YouTube Data API v3</strong> is enabled under APIs & Services → Enabled APIs</li>
                      <li>OAuth consent screen has scope <code className="bg-white/5 px-1 rounded">https://www.googleapis.com/auth/youtube.readonly</code></li>
                      <li>Your Google account is added as a <strong className="text-foreground">test user</strong> if the app is in Testing mode</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showSetupGuide && check?.callbackUri && (
              <div className="flex items-center gap-2 pt-0.5">
                <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-mono break-all text-emerald-300 min-w-0">
                  {check.callbackUri}
                </code>
                <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 border border-white/10"
                  onClick={copyCallbackUri}>
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* ── Step 2: Connect button ── */}
        <div>
          <Card className="p-6 glass space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                  <h2 className="font-semibold">Connect via Google</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click below to open Google's consent screen. Works with ANY Google account — completely independent from how you signed in.
                </p>
              </div>
            </div>

            <Button
              className="w-full glow-primary h-11"
              onClick={handleConnectYouTube}
              disabled={(phase as any).id === "starting_oauth"}
            >
              <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect YouTube via Google
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Read-only access · We never post or modify your channel
            </p>
          </Card>
        </div>

        {/* ── Manual URL fallback ── */}
        <div>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1.5"
            onClick={() => setShowManual(v => !v)}
          >
            <Search className="h-3.5 w-3.5" />
            {showManual ? "Hide manual entry" : "Or enter your channel URL manually (uses YouTube Data API key)"}
          </button>

          <AnimatePresence>
            {showManual && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-5 glass space-y-4 mt-2">
                  <div className="space-y-1">
                    <h3 className="font-medium text-sm">Enter channel URL or @handle</h3>
                    <p className="text-xs text-muted-foreground">
                      Note: this only saves the channel ID — no token is stored, so analytics requiring OAuth won't work.
                    </p>
                  </div>
                  <form onSubmit={handleLookup} className="flex gap-2">
                    <Input
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="youtube.com/@yourchannel"
                      className="flex-1 bg-white/5 border-white/10"
                      disabled={phase.id === "looking_up"}
                      autoFocus
                    />
                    <Button type="submit" disabled={phase.id === "looking_up" || !manualInput.trim()} className="shrink-0">
                      {phase.id === "looking_up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
}

function decodeErrorParam(raw: string): string {
  const map: Record<string, string> = {
    access_denied: "You denied access on Google's consent screen. Please try again and click 'Allow'.",
    missing_state: "OAuth state parameter was missing. Please try again.",
    invalid_state: "OAuth state was invalid or expired. Please try again.",
    missing_code: "No authorization code was returned by Google. Please try again.",
    server_misconfigured: "The server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Check your Replit secrets.",
    no_channel: "No YouTube channel was found on that Google account. Create a channel at youtube.com first.",
    server_error: "An unexpected server error occurred. Check the API server logs.",
  };
  if (raw in map) return map[raw];
  if (raw.startsWith("token_exchange_failed:")) {
    return `Google rejected the token exchange: ${raw.replace("token_exchange_failed: ", "")}. This usually means the redirect URI isn't registered in Google Cloud Console.`;
  }
  if (raw.startsWith("youtube_api_error:")) {
    return `YouTube API error: ${raw.replace("youtube_api_error: ", "")}`;
  }
  return `OAuth error: ${raw}`;
}
