import { useState } from "react";
import { useGenerateReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ReportDownloadButton({
  channelId,
  creatorName,
}: {
  channelId: string;
  creatorName?: string;
}) {
  const gen = useGenerateReport();
  const { toast } = useToast();

  const download = async () => {
    try {
      const result = await gen.mutateAsync({
        data: { channelId, platform: "YouTube", creatorName },
      });
      const binary = atob(result.docxBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Report downloaded", description: result.filename });
    } catch (e) {
      toast({
        title: "Report generation failed",
        description: "AI is busy, try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      disabled={gen.isPending}
      className="border-white/10 hover:border-primary/40"
    >
      {gen.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {gen.isPending ? "Generating report…" : "Export DOCX report"}
    </Button>
  );
}
