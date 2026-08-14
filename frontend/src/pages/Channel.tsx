import { useParams } from "wouter";
import { useGetChannel, useCreateSavedAnalysis } from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-react";
import { Loader2, BookmarkPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ChannelHeader from "@/components/ChannelHeader";
import MetricGrid from "@/components/MetricGrid";
import ViewTrendChart from "@/components/ViewTrendChart";
import RecentVideosList from "@/components/RecentVideosList";
import AnalysisPanel from "@/components/AnalysisPanel";
import TitleOptimizerPanel from "@/components/TitleOptimizerPanel";
import ThumbnailABPanel from "@/components/ThumbnailABPanel";
import RetentionMapperPanel from "@/components/RetentionMapperPanel";
import WhyFailedPanel from "@/components/WhyFailedPanel";
import VideoBreakdownPanel from "@/components/VideoBreakdownPanel";
import CompetitorsPanel from "@/components/CompetitorsPanel";
import ReportDownloadButton from "@/components/ReportDownloadButton";
import { useToast } from "@/hooks/use-toast";

export default function ChannelPage() {
  const params = useParams<{ id: string }>();
  const channelId = params.id!;
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetChannel(channelId);
  const save = useCreateSavedAnalysis({
    mutation: {
      onSuccess: () => toast({ title: "Saved", description: "Analysis added to your library." }),
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading channel…
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {(error as Error)?.message || "Channel not found"}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ChannelHeader data={data} />

      {isSignedIn && (
        <div className="flex flex-wrap gap-2">
          <ReportDownloadButton channelId={data.id} creatorName={data.title} />
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate({ data: { channelId: data.id } })}
          >
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
            Save analysis
          </Button>
        </div>
      )}

      <MetricGrid data={data} />

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">View trend</h2>
          <div className="text-xs text-muted-foreground">Recent {data.viewTrend.length} videos</div>
        </div>
        <ViewTrendChart points={data.viewTrend} />
      </Card>

      <AnalysisPanel channelId={data.id} channelTitle={data.title} />

      <VideoBreakdownPanel channelId={data.id} />
      <CompetitorsPanel channelId={data.id} />

      <Tabs defaultValue="titles">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="titles">Title Optimizer</TabsTrigger>
          <TabsTrigger value="thumbnail">Thumbnail A/B</TabsTrigger>
          <TabsTrigger value="retention">Retention Mapper</TabsTrigger>
          <TabsTrigger value="failed">Why It Failed</TabsTrigger>
        </TabsList>
        <TabsContent value="titles" className="mt-4">
          <TitleOptimizerPanel
            defaultTitle={data.recentVideos[0]?.title}
            channelTitle={data.title}
          />
        </TabsContent>
        <TabsContent value="thumbnail" className="mt-4">
          <ThumbnailABPanel />
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <RetentionMapperPanel videos={data.recentVideos} />
        </TabsContent>
        <TabsContent value="failed" className="mt-4">
          <WhyFailedPanel channelId={data.id} videos={data.recentVideos} />
        </TabsContent>
      </Tabs>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent videos</h2>
        <RecentVideosList videos={data.recentVideos} />
      </Card>
    </div>
  );
}
