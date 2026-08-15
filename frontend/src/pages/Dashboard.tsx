import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut, useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import {
  useGetConnectedProfile,
  useGetChannel,
  useUnlinkChannel,
  useCreateSavedAnalysis,
  useListSavedAnalyses,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Link2,
  BarChart3,
  LogOut,
  Unlink,
  BookmarkPlus,
  Sparkles,
  Image as ImageIcon,
  Activity as ActivityIcon,
  Wand2,
  AlertTriangle,
  Trophy,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import ChannelHeader from "@/components/ChannelHeader";
import MetricGrid from "@/components/MetricGrid";
import ViewTrendChart from "@/components/ViewTrendChart";
import AnalysisPanel from "@/components/AnalysisPanel";
import AlertsCard from "@/components/AlertsCard";
import ProfileCard from "@/components/ProfileCard";
import VideoBreakdownPanel from "@/components/VideoBreakdownPanel";
import CompetitorsPanel from "@/components/CompetitorsPanel";
import { useToast } from "@/hooks/use-toast";
import { compactNumber, dayOfWeek } from "@/lib/format";
import type { ChannelDetails, VideoSummary } from "@workspace/api-client-react";

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <>
      <SignedOut>
        <Card className="p-8 text-center">
          <p className="mb-4">Please sign in to view your dashboard.</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </Card>
      </SignedOut>
      <SignedIn>
        <DashboardInner />
      </SignedIn>
    </>
  );
}

function DashboardInner() {
  const me = useGetConnectedProfile();
  const { signOut } = useClerk();
  const { user } = useUser();

  if (me.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your profile…
      </div>
    );
  }

  const hasChannel = !!me.data?.channelId;
  const displayName = user?.firstName || user?.username || me.data?.name || "Creator";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasChannel
              ? "Your channel command center."
              : "Connect a channel to unlock your personal command center."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ redirectUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>

      {!hasChannel ? (
        <Card className="space-y-4 p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Link2 className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">Connect your YouTube channel</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with Google to automatically detect and link your YouTube channel. This unlocks your personal analytics dashboard, performance alerts, and AI growth coaching.
          </p>
          <div>
            <Link href="/connect"><Button className="glow-primary">Connect via Google →</Button></Link>
          </div>
        </Card>
      ) : (
        <ConnectedDashboard
          channelId={me.data!.channelId!}
          profile={me.data!}
          onDisconnect={() => me.refetch()}
        />
      )}
    </div>
  );
}

function ConnectedDashboard({
  channelId,
  profile,
  onDisconnect,
}: {
  channelId: string;
  profile: import("@workspace/api-client-react").ConnectedProfile;
  onDisconnect: () => void;
}) {
  const ch = useGetChannel(channelId);
  const unlink = useUnlinkChannel();
  const save = useCreateSavedAnalysis();
  const saved = useListSavedAnalyses();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  if (ch.isLoading || !ch.data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your channel…
      </div>
    );
  }

  const data = ch.data;
  const topVideos = [...data.recentVideos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  const flopVideo = [...data.recentVideos]
    .sort((a, b) => a.views - b.views)[0];
  const lastSaved = saved.data?.items?.[0];

  const handleDisconnect = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    unlink.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Channel disconnected", description: "You can reconnect any time from the analyzer." });
        onDisconnect();
      },
      onError: () => toast({ title: "Could not disconnect", variant: "destructive" }),
    });
  };

  const handleSaveAnalysis = () => {
    save.mutate(
      { data: { channelId: data.id } },
      {
        onSuccess: () => {
          toast({ title: "Analysis saved", description: "View it in Saved." });
          saved.refetch();
        },
        onError: () => toast({ title: "Could not save analysis", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <ChannelHeader data={data} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSaveAnalysis} disabled={save.isPending} size="sm">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
          Save snapshot
        </Button>
        <Link href={`/channel/${data.id}`}>
          <Button variant="outline" size="sm">
            <BarChart3 className="mr-2 h-4 w-4" /> Full analyzer
          </Button>
        </Link>
        <Link href="/saved">
          <Button variant="outline" size="sm">
            <Trophy className="mr-2 h-4 w-4" /> Saved analyses
          </Button>
        </Link>
        <a
          href={`https://www.youtube.com/channel/${data.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block"
        >
          <Button variant="outline" size="sm">
            <PlayCircle className="mr-2 h-4 w-4" /> Open on YouTube
          </Button>
        </a>
        <Button
          variant={confirming ? "destructive" : "outline"}
          size="sm"
          onClick={handleDisconnect}
          disabled={unlink.isPending}
          className="sm:ml-auto"
        >
          {unlink.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="mr-2 h-4 w-4" />
          )}
          {confirming ? "Click again to confirm" : "Disconnect channel"}
        </Button>
      </div>

      <MetricGrid data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><AlertsCard /></div>
        <ProfileCard profile={profile} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-4 w-4 shrink-0" /> View trend (last 25 videos)
            </h2>
            <span className="text-xs text-muted-foreground">
              Avg {compactNumber(data.avgViews)} · Median {compactNumber(data.medianViews)}
            </span>
          </div>
          <ViewTrendChart points={data.viewTrend} />
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Quick AI tools
          </h2>
          <div className="grid gap-2">
            <ToolLink
              to={`/channel/${data.id}#title-optimizer`}
              icon={<Wand2 className="h-4 w-4" />}
              label="Optimize a title"
              hint="Generate 10 high-CTR variants"
            />
            <ToolLink
              to={`/channel/${data.id}#thumbnail-ab`}
              icon={<ImageIcon className="h-4 w-4" />}
              label="Thumbnail A/B test"
              hint="Vision AI picks the winner"
            />
            <ToolLink
              to={`/channel/${data.id}#retention`}
              icon={<ActivityIcon className="h-4 w-4" />}
              label="Predict retention"
              hint="See where viewers drop off"
            />
            {flopVideo && (
              <ToolLink
                to={`/channel/${data.id}#why-failed`}
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Why did it flop?"
                hint={`Diagnose "${truncate(flopVideo.title, 32)}"`}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <TopVideosCard videos={topVideos} />
        <PostingInsightCard data={data} />
        <RecentSavedCard
          lastDiagnosis={lastSaved?.diagnosis ?? null}
          lastDate={lastSaved?.createdAt ?? null}
        />
      </div>

      <VideoBreakdownPanel channelId={data.id} />
      <CompetitorsPanel channelId={data.id} />
      <AnalysisPanel channelId={data.id} channelTitle={data.title} />
    </div>
  );
}

function ToolLink({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link href={to}>
      <div className="hover-elevate group flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-3 transition-colors">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">
          {icon}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function TopVideosCard({ videos }: { videos: VideoSummary[] }) {
  return (
    <Card className="space-y-3 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-4 w-4 text-amber-400" /> Top recent videos
      </h2>
      <div className="space-y-2">
        {videos.map((v, i) => (
          <a
            key={v.id}
            href={`https://www.youtube.com/watch?v=${v.id}`}
            target="_blank"
            rel="noreferrer"
            className="hover-elevate flex items-center gap-3 rounded-md p-2"
          >
            <span className="w-5 text-xs font-bold text-muted-foreground">#{i + 1}</span>
            <img src={v.thumbnail} alt="" className="h-10 w-16 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{v.title}</div>
              <div className="text-xs text-muted-foreground">
                {compactNumber(v.views)} views · {compactNumber(v.likes)} likes
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

function PostingInsightCard({ data }: { data: ChannelDetails }) {
  const cadenceTone =
    data.uploadCadencePerWeek >= 2
      ? "Solid cadence — keep it up."
      : data.uploadCadencePerWeek >= 1
      ? "Decent cadence. Consider one more upload per week."
      : "Low cadence. Aim for at least 1 video/week for momentum.";

  const engagementTone =
    data.engagementRate >= 0.05
      ? "Strong audience engagement."
      : data.engagementRate >= 0.02
      ? "Healthy engagement."
      : "Low engagement — try stronger CTAs and pinned comments.";

  return (
    <Card className="space-y-3 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Posting playbook
      </h2>
      <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Best slot
        </div>
        <div className="text-base font-semibold">
          {dayOfWeek(data.bestPostingHour.dayOfWeek)} @{" "}
          {String(data.bestPostingHour.hour).padStart(2, "0")}:00 UTC
        </div>
        <div className="text-xs text-muted-foreground">
          Based on highest avg views in your last uploads.
        </div>
      </div>
      <Insight label="Cadence" text={cadenceTone} />
      <Insight label="Engagement" text={engagementTone} />
      <Insight
        label="Reach"
        text={
          data.viewsPerSubRatio >= 1
            ? "You're reaching beyond your subscriber base — algorithm is pushing you."
            : "Most views come from subscribers. Optimize titles & thumbs to reach new viewers."
        }
      />
    </Card>
  );
}

function Insight({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

function RecentSavedCard({
  lastDiagnosis,
  lastDate,
}: {
  lastDiagnosis: string | null;
  lastDate: string | null;
}) {
  return (
    <Card className="space-y-3 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <BookmarkPlus className="h-4 w-4 text-accent" /> Latest saved snapshot
      </h2>
      {lastDiagnosis ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">{lastDiagnosis}</p>
          {lastDate && (
            <p className="text-xs text-muted-foreground">
              Saved {new Date(lastDate).toLocaleString()}
            </p>
          )}
          <Link href="/saved">
            <Button variant="outline" size="sm" className="w-full">
              View all saved
            </Button>
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          You haven't saved any analyses yet. Click "Save snapshot" above to track your channel over time.
        </p>
      )}
    </Card>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
