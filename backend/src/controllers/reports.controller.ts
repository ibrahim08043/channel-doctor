import type { Request, Response, NextFunction } from "express";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, Header, Footer, PageNumber,
} from "docx";
import { jsonCompletion, FAST_MODEL } from "../services/groq.service";
import { getChannelRaw, getRecentVideos } from "../services/youtube.service";
import { deriveMetrics, healthScore } from "../services/analysis.service";
import { compactNum } from "../utils/format";
import { analyzeSocial as analyzeSocialService } from "../services/social-analyzer.service";

const SOCIAL_ANALYSIS_TIMEOUT_MS = 120_000; // 120s hard ceiling for the endpoint

/**
 * Analyze an Instagram or Facebook profile.
 *
 * These analyzers are AI-only (Groq); they do NOT need Instagram/Facebook API
 * credentials. The only required credential is GROQ_API_KEY. When that is
 * missing we fail fast with an actionable message instead of hanging, and a
 * per-request timeout guarantees the endpoint can never run forever.
 */
export async function analyzeSocial(req: Request, res: Response, next: NextFunction) {
  try {
    const { platform, handle, personality, depth, creativity, focusAreas } = req.body || {};
    if (!platform || !handle) { res.status(400).json({ error: "platform and handle required" }); return; }
    const p = String(platform).toLowerCase();
    if (p !== "instagram" && p !== "facebook") { res.status(400).json({ error: "platform must be 'instagram' or 'facebook'" }); return; }
    const h = String(handle).trim().replace(/^@/, "");
    if (!h) { res.status(400).json({ error: "handle required" }); return; }

    // The analyzer is entirely LLM-driven. If the Groq key is absent there is
    // no point attempting anything — fail fast with a clear message.
    if (!process.env.GROQ_API_KEY) {
      res.status(500).json({ error: "Instagram API credentials missing" });
      return;
    }

    let result: import("../services/social-analyzer.service").SocialAnalysisResult;
    try {
      result = await withTimeout(
        analyzeSocialService({
          platform: p,
          handle: h,
          personality: typeof personality === "string" ? personality : undefined,
          depth: typeof depth === "string" ? depth : undefined,
          creativity: typeof creativity === "number" ? creativity : undefined,
          focusAreas: Array.isArray(focusAreas) ? focusAreas.map(String) : undefined,
        }),
        SOCIAL_ANALYSIS_TIMEOUT_MS,
        `${p === "instagram" ? "Instagram" : "Facebook"} API request timed out`,
      );
    } catch (timeoutErr) {
      res.status(504).json({ error: (timeoutErr as Error).message });
      return;
    }

    res.json(result);
  } catch (err) { next(err); }
}

/** Resolve a promise or reject after `ms` with the given message. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export async function generateSocialReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { analysis } = req.body || {};
    if (!analysis || !analysis.platform || !analysis.handle) { res.status(400).json({ error: "analysis object required" }); return; }
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const titleColor = "7C3AED";
    const platformLabel = analysis.platform === "instagram" ? "Instagram" : "Facebook";

    const section = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, thematicBreak: true });
    const subSection = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } });
    const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 24 })], spacing: { before: 80, after: 80 } });
    const bullet = (text: string) => new Paragraph({ children: [new TextRun({ text: `• ${text}`, size: 22 })], spacing: { before: 50, after: 50 }, indent: { left: 360 } });
    const numbered = (text: string, n: number) => new Paragraph({ children: [new TextRun({ text: `${n}. ${text}`, size: 22 })], spacing: { before: 50, after: 50 }, indent: { left: 360 } });
    const scoreColor = (s: number) => s >= 75 ? "16A34A" : s >= 55 ? "D97706" : "DC2626";
    const headerRow = (cols: string[]) => new TableRow({ tableHeader: true, children: cols.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })], shading: { type: ShadingType.SOLID, color: titleColor } })] })) });

    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: "", spacing: { before: 1600 } }),
      new Paragraph({ children: [new TextRun({ text: "SocialPulse AI", bold: true, size: 72, color: titleColor })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${platformLabel.toUpperCase()} INTELLIGENCE REPORT`, size: 32, color: "6B7280", characterSpacing: 200 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun({ text: `@${analysis.handle}`, bold: true, size: 52, color: "0A0A0F" })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: dateStr, size: 24, color: "9CA3AF" })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      new Paragraph({ children: [new TextRun({ text: `Overall Score: ${analysis.overallScore}/100`, bold: true, size: 44, color: scoreColor(analysis.overallScore) })], alignment: AlignmentType.CENTER, spacing: { after: 1600 } }),
      section("Executive Summary"),
      new Paragraph({ children: [new TextRun({ text: analysis.headline, bold: true, size: 28, color: titleColor })], spacing: { after: 160 } }),
      body(analysis.summary),
      section("Performance Scorecard"),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow(["Category", "Score", "Assessment"]), ...analysis.categories.map((c: any) => new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.name, bold: true, size: 22 })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${c.score}/100`, bold: true, size: 22, color: scoreColor(c.score) })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.notes, size: 20 })] })] })] }))] }),
      section("Quick Wins"),
      ...analysis.quickWins.map((w: string, i: number) => numbered(w, i + 1)),
      section("Important Disclaimer"),
      body(analysis.disclaimer || "This analysis is AI-estimated."),
      new Paragraph({ children: [new TextRun({ text: "— End of Report —", color: "9CA3AF", italics: true })], alignment: AlignmentType.CENTER }),
    ];

    const doc = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 24 } }, heading1: { run: { font: "Calibri", size: 32, bold: true, color: titleColor } }, heading2: { run: { font: "Calibri", size: 26, bold: true, color: "374151" } } } }, sections: [{ headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "SocialPulse AI  ·  ", bold: true, color: titleColor }), new TextRun({ text: `${platformLabel} Intelligence Report`, color: "6B7280" })], alignment: AlignmentType.RIGHT })], }) }, footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: `Generated ${dateStr}  ·  Page `, color: "9CA3AF" }), new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF" })], alignment: AlignmentType.CENTER })], }) }, children }] });
    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = `SocialPulse_${platformLabel}_Report_${analysis.handle.replace(/[^a-z0-9]/gi, "_").slice(0, 30)}_${now.toISOString().slice(0, 10)}.docx`;
    res.json({ docxBase64: base64, filename });
  } catch (err) { next(err); }
}

export async function generateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { channelId, platform = "YouTube", creatorName } = req.body || {};
    if (!channelId) { res.status(400).json({ error: "channelId required" }); return; }
    const channel = await getChannelRaw(String(channelId));
    if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);
    const aiReport = await jsonCompletion<{ executiveSummary: string; keyFindings: string[]; competitorSummary: string; recommendations: { title: string; description: string; priority: "high" | "medium" | "low" }[]; roadmap: { week: string; actions: string[] }[]; conclusion: string }>(
      "You are a senior YouTube strategy consultant. Return strict JSON.",
      `Write a full consulting report.\nChannel: ${channel.title}\nSubs: ${compactNum(channel.subscriberCount)}\nAvg views: ${compactNum(Math.round(metrics.avgViews))}\nEngagement: ${(metrics.engagementRate * 100).toFixed(2)}%\nHealth: ${health.score}/100\nReturn JSON: { executiveSummary: string, keyFindings: string[], competitorSummary: string, recommendations: [{title, description, priority}...], roadmap: [{week, actions}...], conclusion: string }`,
      { model: FAST_MODEL, temperature: 0.55 });
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const creator = creatorName || channel.title;
    const titleColor = "7C3AED";
    const section = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, thematicBreak: true });
    const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 24 })], spacing: { before: 100, after: 100 } });
    const bullet = (text: string) => new Paragraph({ children: [new TextRun({ text: `• ${text}`, size: 24 })], spacing: { before: 60, after: 60 }, indent: { left: 360 } });
    const metricTable = () => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: ["Metric", "Value"].map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 24, color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: titleColor }, width: { size: 50, type: WidthType.PERCENTAGE } })) }), ...([["Channel", channel.title], ["Subscribers", compactNum(channel.subscriberCount)], ["Total Views", compactNum(channel.viewCount)], ["Avg Views", compactNum(Math.round(metrics.avgViews))], ["Engagement Rate", `${(metrics.engagementRate * 100).toFixed(2)}%`], ["Uploads/Week", metrics.uploadCadencePerWeek.toFixed(2)], ["Health Score", `${health.score}/100`]].map(([l, v], i) => new TableRow({ children: [l, v].map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, size: 22 })], shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined })] })) })))] });
    const priorityColors: Record<string, string> = { high: "DC2626", medium: "D97706", low: "16A34A" };
    const doc = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 24 } }, heading1: { run: { font: "Calibri", size: 32, bold: true, color: titleColor } }, heading2: { run: { font: "Calibri", size: 26, bold: true, color: "374151" } } } }, sections: [{ headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "SocialPulse AI  ·  ", bold: true, color: titleColor }), new TextRun({ text: "Confidential Growth Report", color: "6B7280" })], alignment: AlignmentType.RIGHT })], }) }, footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: `Generated ${dateStr}  ·  Page `, color: "9CA3AF" }), new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF" })], alignment: AlignmentType.CENTER })], }) }, children: [new Paragraph({ text: "", spacing: { before: 2000 } }), new Paragraph({ children: [new TextRun({ text: "SocialPulse AI", bold: true, size: 72, color: titleColor })], alignment: AlignmentType.CENTER }), new Paragraph({ children: [new TextRun({ text: "GROWTH INTELLIGENCE REPORT", size: 36, color: "6B7280", characterSpacing: 200 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }), new Paragraph({ children: [new TextRun({ text: creator, bold: true, size: 48, color: "0A0A0F" })], alignment: AlignmentType.CENTER }), new Paragraph({ children: [new TextRun({ text: dateStr, size: 24, color: "9CA3AF" })], alignment: AlignmentType.CENTER, spacing: { after: 600 } }), new Paragraph({ children: [new TextRun({ text: `Health Score: ${health.score}/100`, bold: true, size: 40, color: health.score >= 70 ? "16A34A" : "D97706" })], alignment: AlignmentType.CENTER, spacing: { after: 2000 } }), section("Executive Summary"), body(aiReport.executiveSummary), section("Channel Metrics"), metricTable(), section("Key Findings"), ...aiReport.keyFindings.map((f) => bullet(f)), section("Competitive Landscape"), body(aiReport.competitorSummary), section("Recommendations"), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: ["Recommendation", "Priority", "Description"].map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: titleColor } })) }), ...aiReport.recommendations.map((r) => new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.title, bold: true, size: 22 })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.priority.toUpperCase(), bold: true, size: 22, color: priorityColors[r.priority] || "000000" })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.description, size: 20 })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } })] })] }))] }), section("Growth Roadmap"), ...aiReport.roadmap.flatMap((p) => [new Paragraph({ text: p.week, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }), ...p.actions.map((a) => bullet(a))]), section("Conclusion"), body(aiReport.conclusion), section("Recent Videos"), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: ["Title", "Views", "Engagement"].map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })], shading: { type: ShadingType.SOLID, color: titleColor } })) }), ...videos.slice(0, 5).map((v, i) => new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.title, size: 20 })], shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: compactNum(v.views), size: 20 })], shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.views > 0 ? `${(((v.likes || 0) + (v.comments || 0)) / v.views * 100).toFixed(2)}%` : "—", size: 20 })], shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined })] })] }))] }), new Paragraph({ children: [new TextRun({ text: "— End of Report —", color: "9CA3AF", italics: true })], alignment: AlignmentType.CENTER })] }] });
    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = `SocialPulse_Report_${channel.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_${now.toISOString().slice(0, 10)}.docx`;
    res.json({ docxBase64: base64, filename });
  } catch (err) { next(err); }
}
