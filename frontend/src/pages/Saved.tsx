import { Link, useLocation } from "wouter";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useListSavedAnalyses, useDeleteSavedAnalysis, getListSavedAnalysesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChannelAvatar from "@/components/ChannelAvatar";
import { Loader2, Trash2, ExternalLink } from "lucide-react";
import { compactNumber, formatDate, healthBadge, healthColor } from "@/lib/format";

export default function SavedPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <>
      <SignedOut>
        <Card className="p-8 text-center">
          <p className="mb-4">Please sign in to see your saved analyses.</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </Card>
      </SignedOut>
      <SignedIn>
        <SavedInner />
      </SignedIn>
    </>
  );
}

function SavedInner() {
  const qc = useQueryClient();
  const { data, isLoading } = useListSavedAnalyses();
  const del = useDeleteSavedAnalysis({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSavedAnalysesQueryKey() }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading saved analyses…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Saved analyses</h1>
      {(!data || (data.items?.length ?? 0) === 0) && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          You haven't saved any analyses yet. Open a channel and click "Save analysis".
        </Card>
      )}
      <div className="grid gap-3">
        {data?.items.map((it) => (
          <Card key={it.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <ChannelAvatar src={it.channelThumbnail} alt={it.channelTitle} className="h-14 w-14 rounded-full border border-border/60" />
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">{it.channelTitle}</div>
                <div className={`rounded-full border border-current/30 bg-current/10 px-2 py-0.5 text-[10px] font-semibold ${healthColor(it.healthScore)}`}>
                  {Math.round(it.healthScore)} · {healthBadge(it.healthScore)}
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(it.createdAt)}</div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{it.diagnosis}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/channel/${it.channelId}`}>
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Open</Button>
              </Link>
              <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => del.mutate({ id: it.id })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
