import { useUser } from "@clerk/clerk-react";
import { useGetConnectedProfile, useGetUserStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import {
  User as UserIcon,
  Trophy,
  Calendar,
  Stethoscope,
  Youtube,
  Award,
  Loader2,
  Crown,
  Lock,
} from "lucide-react";
import { formatDate } from "@/lib/format";

const ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  stethoscope: Stethoscope,
  youtube: Youtube,
  award: Award,
  calendar: Calendar,
};

export default function ProfilePage() {
  const { user } = useUser();
  const me = useGetConnectedProfile();
  const stats = useGetUserStats();

  const name = user?.fullName || me.data?.name || "Creator";
  const email = user?.primaryEmailAddress?.emailAddress || me.data?.email;
  const avatar = user?.imageUrl || me.data?.avatar;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {avatar ? (
            <img src={avatar} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/15 text-primary">
              <UserIcon className="h-10 w-10" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{name}</h1>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                <Crown className="h-3 w-3 text-amber-400" />
                {me.data?.plan === "pro" ? "Pro" : "Free"} plan
              </span>
              {stats.data && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                  <Calendar className="h-3 w-3" />
                  Joined {formatDate(stats.data.joinedAt)}
                </span>
              )}
              {me.data?.channelTitle && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                  <Youtube className="h-3 w-3 text-rose-400" />
                  {me.data.channelTitle}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Reports saved"
          value={stats.data?.savedReports ?? "—"}
          loading={stats.isLoading}
          icon={Stethoscope}
        />
        <StatCard
          label="Channel connected"
          value={stats.data?.channelConnected ? "Yes" : "No"}
          loading={stats.isLoading}
          icon={Youtube}
        />
        <StatCard
          label="Achievements"
          value={
            stats.data
              ? `${stats.data.achievements.filter((a) => a.unlocked).length}/${stats.data.achievements.length}`
              : "—"
          }
          loading={stats.isLoading}
          icon={Trophy}
        />
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-4 w-4 text-amber-400" /> Achievements
        </h2>
        {stats.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stats.data?.achievements.map((a) => {
              const Icon = ICONS[a.icon] ?? Trophy;
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                    a.unlocked
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border/40 bg-background/40 opacity-60"
                  }`}
                >
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-md ${
                      a.unlocked ? "bg-amber-500/20 text-amber-300" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  loading: boolean;
  icon: typeof Trophy;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-3xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}</div>
    </Card>
  );
}
