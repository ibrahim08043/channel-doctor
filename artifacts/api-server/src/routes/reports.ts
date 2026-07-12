import { Router, type IRouter } from "express";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { jsonCompletion } from "../services/openaiClient";
import { getChannelRaw, getRecentVideos } from "../services/youtube";
import { deriveMetrics, healthScore } from "../services/analysis";
import { compactNum } from "../utils/format";

const router: IRouter = Router();

const PERSONALITY_SYSTEM: Record<string, string> = {
  consultant:
    "You are a senior social media strategist at a top-tier management consulting firm. You deliver executive-level insights with precision and strategic foresight. Every recommendation has measurable impact and clear ROI.",
  growthhacker:
    "You are an aggressive growth hacker obsessed with viral mechanics, rapid scaling, and exploiting platform algorithms. You prioritize speed and impact over brand polish. Be bold, provocative, and specific.",
  branding:
    "You are a brand identity expert with deep expertise in visual storytelling, audience perception, and brand equity. You see every element through the lens of brand consistency, memorability, and emotional resonance.",
  coach:
    "You are an encouraging but honest content coach who specializes in helping creators find their voice and build authentic communities. You balance brutal honesty with actionable motivation.",
  analyst:
    "You are a data-driven social media analyst who backs every recommendation with benchmarks, competitive comparisons, and platform-specific metrics. You speak in numbers and evidence.",
};

const DEPTH_INSTRUCTIONS: Record<string, string> = {
  quick: "Provide concise, high-impact insights. 2-3 sentences per section, 3 items per list max.",
  standard: "Provide thorough analysis. 3-4 sentences per section, 5 items per list.",
  deep: "Provide exhaustive, consulting-grade analysis. Full paragraphs where needed, 6+ items per list, examples for every recommendation.",
  enterprise:
    "Provide board-level, data-rich analysis. Every insight must include a 'why it matters', a benchmark comparison, and a specific execution plan with timeline.",
};

router.post("/ai/analyze-social", async (req, res, next) => {
  try {
    const {
      platform,
      handle,
      personality = "consultant",
      style = "detailed",
      depth = "standard",
      creativity = 60,
      focusAreas = [],
    } = req.body || {};

    if (!platform || !handle) {
      res.status(400).json({ error: "platform and handle required" });
      return;
    }

    const p = String(platform).toLowerCase() as "instagram" | "facebook";
    const h = String(handle).replace(/^@/, "");
    const temp = 0.4 + (Number(creativity) / 100) * 0.45;

    const systemPersona =
      PERSONALITY_SYSTEM[personality] ||
      PERSONALITY_SYSTEM.consultant;
    const depthInstr =
      DEPTH_INSTRUCTIONS[depth] || DEPTH_INSTRUCTIONS.standard;

    const focusPriority =
      Array.isArray(focusAreas) && focusAreas.length > 0
        ? `\nPrioritize these focus areas above all else: ${focusAreas.join(", ")}.`
        : "";

    const styleNote =
      style === "executive"
        ? "Write in executive summary style — punchy, decisive, no filler."
        : style === "beginner"
        ? "Explain every recommendation clearly for someone new to social media."
        : style === "advanced"
        ? "Use advanced platform-specific terminology and assume high expertise."
        : style === "direct"
        ? "Be extremely direct. No pleasantries. Just the truth."
        : "Be thorough and clear.";

    const system = `${systemPersona} ${depthInstr} ${styleNote} Return only valid JSON — no markdown, no code fences, no commentary.${focusPriority}`;

    if (p === "instagram") {
      type IGResult = {
        overallScore: number;
        headline: string;
        summary: string;
        categories: { name: string; score: number; notes: string }[];
        strategies: { title: string; reason: string; impact: string; steps: string[] }[];
        quickWins: string[];
        instagramInsights: {
          usernameScore: number;
          usernameAlts: { handle: string; reason: string }[];
          profileBrandingScore: number;
          profileNotes: string;
          bioScore: number;
          bioIssues: string[];
          bioVersions: { type: string; bio: string; reasoning: string }[];
          contentPillars: { name: string; percentage: number; strength: string }[];
          weakTopics: string[];
          overusedTopics: string[];
          reelScore: number;
          hookScore: number;
          viralProbability: number;
          reelRecommendations: string[];
          captionScore: number;
          improvedCaptions: string[];
          hashtagScore: number;
          hashtagClusters: { name: string; hashtags: string[]; strength: string }[];
          engagementTrend: string;
          strongCategories: string[];
          engagementActions: string[];
        };
      };

      const result = await jsonCompletion<IGResult>(
        system,
        `Perform a comprehensive, professional Instagram intelligence audit on @${h}.

RETURN THIS EXACT JSON STRUCTURE (fill in all values with real insight):

{
  "overallScore": <0-100 weighted from all categories>,
  "headline": "<one punchy diagnostic sentence>",
  "summary": "<3-4 sentence strategic overview — be specific to this account>",
  "categories": [
    {"name": "Content Quality", "score": <0-100>, "notes": "<specific 1-2 sentence assessment>"},
    {"name": "Posting Consistency", "score": <0-100>, "notes": "<specific>"},
    {"name": "Engagement Rate", "score": <0-100>, "notes": "<benchmark comparison>"},
    {"name": "Reels Performance", "score": <0-100>, "notes": "<specific>"},
    {"name": "Hashtag Strategy", "score": <0-100>, "notes": "<specific>"}
  ],
  "strategies": [
    {"title": "<pillar name>", "reason": "<why this matters>", "impact": "<high/medium/low>", "steps": ["step1", "step2", "step3"]},
    ... 4 total
  ],
  "quickWins": ["<5 specific, actionable quick wins implementable in 24 hours>"],
  "instagramInsights": {
    "usernameScore": <0-100>,
    "usernameAlts": [
      {"handle": "<suggested handle 1>", "reason": "<why it's better>"},
      {"handle": "<suggested handle 2>", "reason": "<why it's better>"}
    ],
    "profileBrandingScore": <0-100>,
    "profileNotes": "<specific assessment of profile photo, highlights, branding consistency>",
    "bioScore": <0-100>,
    "bioIssues": ["<specific bio problem 1>", "<specific bio problem 2>", "<specific bio problem 3>"],
    "bioVersions": [
      {"type": "Professional", "bio": "<rewritten bio — max 150 chars, includes CTA>", "reasoning": "<why this works>"},
      {"type": "Personal Brand", "bio": "<rewritten bio — conversational, relatable>", "reasoning": "<why this works>"},
      {"type": "Growth-Focused", "bio": "<rewritten bio — optimized for follows and link clicks>", "reasoning": "<why this works>"}
    ],
    "contentPillars": [
      {"name": "<pillar name>", "percentage": <estimated %>,"strength": "<strong/weak/overused>"},
      ... 4-5 pillars totaling ~100%
    ],
    "weakTopics": ["<topic missing from their mix>", "<another gap>"],
    "overusedTopics": ["<topic they overdo>"],
    "reelScore": <0-100>,
    "hookScore": <0-100>,
    "viralProbability": <0-100>,
    "reelRecommendations": ["<specific reel improvement>", "<another>", "<another>"],
    "captionScore": <0-100>,
    "improvedCaptions": [
      "<Rewritten caption version A — hook + value + CTA>",
      "<Rewritten caption version B — storytelling format>",
      "<Rewritten caption version C — question-driven engagement>"
    ],
    "hashtagScore": <0-100>,
    "hashtagClusters": [
      {"name": "Core Niche", "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"], "strength": "high/medium/low"},
      {"name": "Broad Reach", "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"], "strength": "high/medium/low"},
      {"name": "Micro Niche", "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"], "strength": "high/medium/low"}
    ],
    "engagementTrend": "<declining/stable/growing>",
    "strongCategories": ["<content type that performs best>", "<another>"],
    "engagementActions": ["<specific action to boost engagement>", "<another>", "<another>", "<another>"]
  }
}`,
        { temperature: temp }
      );

      res.json({
        ...result,
        platform: p,
        handle: h,
        disclaimer:
          "This analysis is AI-estimated based on general platform patterns and training knowledge. Connect your account via Instagram's official API for live metrics.",
      });
    } else {
      // Facebook
      type FBResult = {
        overallScore: number;
        headline: string;
        summary: string;
        categories: { name: string; score: number; notes: string }[];
        strategies: { title: string; reason: string; impact: string; steps: string[] }[];
        quickWins: string[];
        facebookInsights: {
          pageTitleScore: number;
          pageDescScore: number;
          brandingImprovements: string[];
          bestFormats: string[];
          recommendedFrequency: string;
          topPostTypes: string[];
          engagementOpportunities: string[];
          interactionStrategy: string;
          roadmap30: { focus: string; actions: string[]; kpis: string[] };
          roadmap60: { focus: string; actions: string[]; kpis: string[] };
          roadmap90: { focus: string; actions: string[]; kpis: string[] };
        };
      };

      const result = await jsonCompletion<FBResult>(
        system,
        `Perform a comprehensive Facebook Page intelligence audit on "${h}".

RETURN THIS EXACT JSON STRUCTURE:

{
  "overallScore": <0-100>,
  "headline": "<one punchy diagnostic sentence for this Facebook page>",
  "summary": "<3-4 sentence strategic overview specific to this page>",
  "categories": [
    {"name": "Page Branding", "score": <0-100>, "notes": "<specific>"},
    {"name": "Content Quality", "score": <0-100>, "notes": "<specific>"},
    {"name": "Posting Frequency", "score": <0-100>, "notes": "<benchmark>"},
    {"name": "Audience Engagement", "score": <0-100>, "notes": "<specific>"},
    {"name": "Content Diversity", "score": <0-100>, "notes": "<specific>"}
  ],
  "strategies": [
    {"title": "<strategy name>", "reason": "<why>", "impact": "<high/medium/low>", "steps": ["step1", "step2", "step3"]},
    ... 4 total
  ],
  "quickWins": ["<5 Facebook-specific quick wins>"],
  "facebookInsights": {
    "pageTitleScore": <0-100>,
    "pageDescScore": <0-100>,
    "brandingImprovements": [
      "<specific page title improvement>",
      "<specific about section improvement>",
      "<specific cover photo or CTA button improvement>",
      "<another>"
    ],
    "bestFormats": ["<format 1 — e.g. Native Video>", "<format 2>", "<format 3>"],
    "recommendedFrequency": "<specific recommendation like '1 post/day + 2 stories'>",
    "topPostTypes": [
      "<post type with specific topic — e.g. Tutorial walkthrough videos>",
      "<another>",
      "<another>"
    ],
    "engagementOpportunities": [
      "<specific opportunity — e.g. Add 'Tag a friend' CTAs to relatable posts>",
      "<another>",
      "<another>",
      "<another>"
    ],
    "interactionStrategy": "<2-3 sentence specific strategy for growing comments/shares>",
    "roadmap30": {
      "focus": "<30-day theme>",
      "actions": ["<specific action 1>", "<specific action 2>", "<specific action 3>", "<specific action 4>"],
      "kpis": ["<KPI 1>", "<KPI 2>"]
    },
    "roadmap60": {
      "focus": "<60-day theme>",
      "actions": ["<specific action 1>", "<specific action 2>", "<specific action 3>", "<specific action 4>"],
      "kpis": ["<KPI 1>", "<KPI 2>"]
    },
    "roadmap90": {
      "focus": "<90-day theme>",
      "actions": ["<specific action 1>", "<specific action 2>", "<specific action 3>", "<specific action 4>"],
      "kpis": ["<KPI 1>", "<KPI 2>"]
    }
  }
}`,
        { temperature: temp }
      );

      res.json({
        ...result,
        platform: p,
        handle: h,
        disclaimer:
          "This analysis is AI-estimated based on general platform patterns and training knowledge. Connect your account via Facebook's official API for live metrics.",
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post("/reports/generate-social", async (req, res, next) => {
  try {
    const { analysis } = req.body || {};
    if (!analysis || !analysis.platform || !analysis.handle) {
      res.status(400).json({ error: "analysis object required" });
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const titleColor = "7C3AED";
    const platformLabel = analysis.platform === "instagram" ? "Instagram" : "Facebook";

    const section = (text: string) =>
      new Paragraph({
        text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        thematicBreak: true,
      });

    const subSection = (text: string) =>
      new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
      });

    const body = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text, size: 24 })],
        spacing: { before: 80, after: 80 },
      });

    const bullet = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text: `• ${text}`, size: 22 })],
        spacing: { before: 50, after: 50 },
        indent: { left: 360 },
      });

    const numbered = (text: string, n: number) =>
      new Paragraph({
        children: [new TextRun({ text: `${n}. ${text}`, size: 22 })],
        spacing: { before: 50, after: 50 },
        indent: { left: 360 },
      });

    const scoreColor = (s: number) => (s >= 75 ? "16A34A" : s >= 55 ? "D97706" : "DC2626");

    const headerRow = (cols: string[]) =>
      new TableRow({
        tableHeader: true,
        children: cols.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })],
              shading: { type: ShadingType.SOLID, color: titleColor },
            })
        ),
      });

    // ── Score table ──────────────────────────────────────────────────────────
    const scoreTable = () =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Category", "Score", "Assessment"]),
          ...analysis.categories.map((c: any, i: number) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.name, bold: true, size: 22 })] })] }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: `${c.score}/100`, bold: true, size: 22, color: scoreColor(c.score) })] })],
                }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.notes, size: 20 })] })] }),
              ],
            })
          ),
        ],
      });

    // ── Strategies table ─────────────────────────────────────────────────────
    const strategiesTable = () =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Strategy", "Impact", "Steps"]),
          ...analysis.strategies.map((s: any) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.title, bold: true, size: 22 })] })] }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: s.impact.toUpperCase(),
                          bold: true,
                          size: 22,
                          color: s.impact.toLowerCase() === "high" ? "DC2626" : s.impact.toLowerCase() === "medium" ? "D97706" : "16A34A",
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.steps.join(" → "), size: 20 })] })] }),
              ],
            })
          ),
        ],
      });

    // ── Instagram insights sections ───────────────────────────────────────────
    const igSections: (Paragraph | Table)[] = [];
    if (analysis.platform === "instagram" && analysis.instagramInsights) {
      const ig = analysis.instagramInsights;

      igSections.push(section("Profile Intelligence"));

      // Username table
      igSections.push(subSection("Username & Handle Analysis"));
      igSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Username Score", "Suggested Handle", "Reasoning"]),
            ...ig.usernameAlts.map((alt: any) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${ig.usernameScore}/100`, size: 22, color: scoreColor(ig.usernameScore) })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `@${alt.handle}`, bold: true, size: 22, color: titleColor })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: alt.reason, size: 20 })] })] }),
                ],
              })
            ),
          ],
        })
      );
      igSections.push(new Paragraph({ text: ig.profileNotes, children: [new TextRun({ text: ig.profileNotes, size: 22, italics: true })] }));

      // Bio optimization
      igSections.push(subSection("Bio Optimization Engine"));
      igSections.push(body(`Bio Score: ${ig.bioScore}/100`));
      if (ig.bioIssues.length) igSections.push(body(`Issues: ${ig.bioIssues.join(", ")}`));
      igSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Version", "Optimized Bio", "Why It Works"]),
            ...ig.bioVersions.map((v: any, i: number) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.type, bold: true, size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.bio, size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.reasoning, size: 20 })] })] }),
                ],
              })
            ),
          ],
        })
      );

      // Content mix
      igSections.push(section("Content Intelligence"));
      igSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Content Pillar", "Mix %", "Strength"]),
            ...ig.contentPillars.map((p: any, i: number) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${p.percentage}%`, size: 22 })] })] }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: p.strength, size: 22, color: p.strength === "strong" ? "16A34A" : p.strength === "overused" ? "DC2626" : "D97706" })] })],
                  }),
                ],
              })
            ),
          ],
        })
      );
      if (ig.weakTopics.length) igSections.push(body(`Content gaps to fill: ${ig.weakTopics.join(", ")}`));
      if (ig.overusedTopics.length) igSections.push(body(`Overused topics to reduce: ${ig.overusedTopics.join(", ")}`));

      // Reels
      igSections.push(section("Reels Intelligence"));
      igSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Reel Score", "Hook Score", "Viral Probability"]),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${ig.reelScore}/100`, bold: true, size: 26, color: scoreColor(ig.reelScore) })] })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${ig.hookScore}/100`, bold: true, size: 26, color: scoreColor(ig.hookScore) })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${ig.viralProbability}%`, bold: true, size: 26, color: scoreColor(ig.viralProbability) })] })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } }),
              ],
            }),
          ],
        })
      );
      igSections.push(subSection("Reel Recommendations"));
      ig.reelRecommendations.forEach((r: string, i: number) => igSections.push(numbered(r, i + 1)));

      // Captions
      igSections.push(section("Caption Lab"));
      igSections.push(body(`Caption Score: ${ig.captionScore}/100`));
      const captionTypes = ["Hook-First", "Storytelling", "Question-Driven"];
      ig.improvedCaptions.forEach((cap: string, i: number) => {
        igSections.push(subSection(captionTypes[i] || `Caption ${i + 1}`));
        igSections.push(body(cap));
      });

      // Hashtags
      igSections.push(section("Hashtag Intelligence"));
      igSections.push(body(`Hashtag Strategy Score: ${ig.hashtagScore}/100`));
      ig.hashtagClusters.forEach((cluster: any) => {
        igSections.push(subSection(`${cluster.name} (${cluster.strength})`));
        igSections.push(bullet(cluster.hashtags.join("  ")));
      });

      // Engagement
      igSections.push(section("Engagement Intelligence"));
      igSections.push(body(`Engagement trend: ${ig.engagementTrend.toUpperCase()}`));
      igSections.push(body(`Strong content categories: ${ig.strongCategories.join(", ")}`));
      igSections.push(subSection("Actions to boost engagement"));
      ig.engagementActions.forEach((a: string, i: number) => igSections.push(numbered(a, i + 1)));
    }

    // ── Facebook insights sections ────────────────────────────────────────────
    const fbSections: (Paragraph | Table)[] = [];
    if (analysis.platform === "facebook" && analysis.facebookInsights) {
      const fb = analysis.facebookInsights;

      fbSections.push(section("Page Branding Analysis"));
      fbSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Element", "Score", "Status"]),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Page Title", bold: true, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${fb.pageTitleScore}/100`, bold: true, size: 22, color: scoreColor(fb.pageTitleScore) })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fb.pageTitleScore >= 70 ? "Strong" : fb.pageTitleScore >= 50 ? "Needs work" : "Weak", size: 22 })] })] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Page Description", bold: true, size: 22 })] })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${fb.pageDescScore}/100`, bold: true, size: 22, color: scoreColor(fb.pageDescScore) })] })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fb.pageDescScore >= 70 ? "Strong" : fb.pageDescScore >= 50 ? "Needs work" : "Weak", size: 22 })] })], shading: { type: ShadingType.SOLID, color: "F8F7FF" } }),
              ],
            }),
          ],
        })
      );
      fbSections.push(subSection("Branding Improvements"));
      fb.brandingImprovements.forEach((imp: string, i: number) => fbSections.push(numbered(imp, i + 1)));

      fbSections.push(section("Content Strategy"));
      fbSections.push(body(`Recommended posting frequency: ${fb.recommendedFrequency}`));
      fbSections.push(subSection("Best Content Formats"));
      fb.bestFormats.forEach((f: string) => fbSections.push(bullet(f)));
      fbSections.push(subSection("Top Post Types"));
      fb.topPostTypes.forEach((t: string) => fbSections.push(bullet(t)));
      fbSections.push(subSection("Audience Engagement Strategy"));
      fbSections.push(body(fb.interactionStrategy));
      fbSections.push(subSection("Engagement Opportunities"));
      fb.engagementOpportunities.forEach((op: string, i: number) => fbSections.push(numbered(op, i + 1)));

      fbSections.push(section("90-Day Growth Roadmap"));
      const phases = [
        { label: "Days 1–30", data: fb.roadmap30 },
        { label: "Days 31–60", data: fb.roadmap60 },
        { label: "Days 61–90", data: fb.roadmap90 },
      ];
      fbSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Phase", "Focus Theme", "Key Actions", "Target KPIs"]),
            ...phases.map((phase, i) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: phase.label, bold: true, size: 22 })] })], shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: phase.data.focus, size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: phase.data.actions.join("\n• "), size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (phase.data.kpis || []).join(", "), size: 20 })] })] }),
                ],
              })
            ),
          ],
        })
      );
    }

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Calibri", size: 24 } },
          heading1: { run: { font: "Calibri", size: 32, bold: true, color: titleColor } },
          heading2: { run: { font: "Calibri", size: 26, bold: true, color: "374151" } },
        },
      },
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "SocialPulse AI  ·  ", bold: true, color: titleColor }),
                    new TextRun({ text: `${platformLabel} Intelligence Report`, color: "6B7280" }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Generated by SocialPulse AI  ·  ${dateStr}  ·  Page `, color: "9CA3AF" }),
                    new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF" }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // Cover
            new Paragraph({ text: "", spacing: { before: 1600 } }),
            new Paragraph({
              children: [new TextRun({ text: "SocialPulse AI", bold: true, size: 72, color: titleColor })],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: `${platformLabel.toUpperCase()} INTELLIGENCE REPORT`, size: 32, color: "6B7280", characterSpacing: 200 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `@${analysis.handle}`, bold: true, size: 52, color: "0A0A0F" })],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: dateStr, size: 24, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Overall Score: ${analysis.overallScore}/100`,
                  bold: true,
                  size: 44,
                  color: scoreColor(analysis.overallScore),
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 1600 },
            }),

            // Executive Summary
            section("Executive Summary"),
            new Paragraph({
              children: [new TextRun({ text: analysis.headline, bold: true, size: 28, color: titleColor })],
              spacing: { after: 160 },
            }),
            body(analysis.summary),

            // Scorecard
            section("Performance Scorecard"),
            scoreTable(),

            // Strategies
            section("AI Growth Strategies"),
            strategiesTable(),

            // Quick Wins
            section("Quick Wins — Do These Today"),
            ...analysis.quickWins.map((w: string, i: number) => numbered(w, i + 1)),

            // Platform-specific
            ...(analysis.platform === "instagram" ? igSections : fbSections),

            // Disclaimer
            section("Important Disclaimer"),
            body(analysis.disclaimer),
            new Paragraph({ text: "", spacing: { before: 600 } }),
            new Paragraph({
              children: [new TextRun({ text: "— End of Report —", color: "9CA3AF", italics: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = `SocialPulse_${platformLabel}_Report_${analysis.handle.replace(/[^a-z0-9]/gi, "_").slice(0, 30)}_${now.toISOString().slice(0, 10)}.docx`;

    res.json({ docxBase64: base64, filename });
  } catch (err) {
    next(err);
  }
});

router.post("/reports/generate", async (req, res, next) => {
  try {
    const { channelId, platform = "YouTube", creatorName } = req.body || {};
    if (!channelId) {
      res.status(400).json({ error: "channelId required" });
      return;
    }

    const channel = await getChannelRaw(String(channelId));
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const metrics = deriveMetrics(channel, videos);
    const health = healthScore(metrics, channel);

    const aiReport = await jsonCompletion<{
      executiveSummary: string;
      keyFindings: string[];
      competitorSummary: string;
      recommendations: { title: string; description: string; priority: "high" | "medium" | "low" }[];
      roadmap: { week: string; actions: string[] }[];
      conclusion: string;
    }>(
      "You are a senior YouTube strategy consultant writing a professional analysis report. Return strict JSON.",
      `Write a full consulting report for this channel.
Channel: ${channel.title}
Subscribers: ${compactNum(channel.subscriberCount)}
Total views: ${compactNum(channel.viewCount)}
Avg recent views: ${compactNum(Math.round(metrics.avgViews))}
Engagement rate: ${(metrics.engagementRate * 100).toFixed(2)}%
Upload cadence: ${metrics.uploadCadencePerWeek.toFixed(2)}/week
Health score: ${health.score}/100 (${health.status})
Breakdown: engagement ${health.breakdown.engagement}/100, consistency ${health.breakdown.consistency}/100, growth ${health.breakdown.growth}/100, performance ${health.breakdown.performance}/100
Recent videos: ${videos.slice(0, 5).map((v) => `"${v.title}"`).join(", ")}

Return JSON:
{
  executiveSummary: "3-paragraph summary",
  keyFindings: ["5 specific findings"],
  competitorSummary: "1 paragraph on competitive landscape",
  recommendations: [{"title", "description", "priority": "high|medium|low"}, ...5],
  roadmap: [{"week":"Week 1","actions":["..."]}, {"week":"Week 2-4","actions":["..."]}, {"week":"Month 2","actions":["..."]}],
  conclusion: "strong closing paragraph"
}`,
      { temperature: 0.55 }
    );

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const creator = creatorName || channel.title;
    const titleColor = "7C3AED";

    const section = (text: string) =>
      new Paragraph({
        text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        thematicBreak: true,
      });

    const subSection = (text: string) =>
      new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      });

    const body = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text, size: 24 })],
        spacing: { before: 100, after: 100 },
      });

    const bullet = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text: `• ${text}`, size: 24 })],
        spacing: { before: 60, after: 60 },
        indent: { left: 360 },
      });

    const metricTable = () =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Metric", "Value"].map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 24, color: "FFFFFF" })] })],
                  shading: { type: ShadingType.SOLID, color: titleColor },
                  width: { size: 50, type: WidthType.PERCENTAGE },
                })
            ),
          }),
          ...[
            ["Channel", channel.title],
            ["Subscribers", compactNum(channel.subscriberCount)],
            ["Total Views", compactNum(channel.viewCount)],
            ["Avg Views / Video", compactNum(Math.round(metrics.avgViews))],
            ["Engagement Rate", (metrics.engagementRate * 100).toFixed(2) + "%"],
            ["Uploads / Week", metrics.uploadCadencePerWeek.toFixed(2)],
            ["Health Score", `${health.score}/100`],
          ].map(
            ([label, value], i) =>
              new TableRow({
                children: [label, value].map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 22 })] })],
                      shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined,
                    })
                ),
              })
          ),
        ],
      });

    const priorityColors: Record<string, string> = { high: "DC2626", medium: "D97706", low: "16A34A" };

    const recsTable = () =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Recommendation", "Priority", "Description"].map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })],
                  shading: { type: ShadingType.SOLID, color: titleColor },
                })
            ),
          }),
          ...aiReport.recommendations.map(
            (r) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.title, bold: true, size: 22 })] })] }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: r.priority.toUpperCase(), bold: true, size: 22, color: priorityColors[r.priority] || "000000" })] })],
                  }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.description, size: 20 })] })] }),
                ],
              })
          ),
        ],
      });

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Calibri", size: 24 } },
          heading1: { run: { font: "Calibri", size: 32, bold: true, color: titleColor } },
          heading2: { run: { font: "Calibri", size: 26, bold: true, color: "374151" } },
        },
      },
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "SocialPulse AI  ·  ", bold: true, color: titleColor }),
                    new TextRun({ text: "Confidential Growth Report", color: "6B7280" }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Generated by SocialPulse AI  ·  ", color: "9CA3AF" }),
                    new TextRun({ text: dateStr, color: "9CA3AF" }),
                    new TextRun({ text: "  ·  Page ", color: "9CA3AF" }),
                    new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF" }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            new Paragraph({ text: "", spacing: { before: 2000 } }),
            new Paragraph({
              children: [new TextRun({ text: "SocialPulse AI", bold: true, size: 72, color: titleColor })],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: "GROWTH INTELLIGENCE REPORT", size: 36, color: "6B7280", characterSpacing: 200 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: creator, bold: true, size: 48, color: "0A0A0F" })],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: platform + " Channel Analysis", size: 28, color: "6B7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: dateStr, size: 24, color: "9CA3AF" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 600 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Health Score: ${health.score}/100`, bold: true, size: 40, color: health.score >= 70 ? "16A34A" : health.score >= 50 ? "D97706" : "DC2626" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 2000 },
            }),
            section("Executive Summary"),
            body(aiReport.executiveSummary),
            section("Channel Metrics"),
            metricTable(),
            section("Key Findings"),
            ...aiReport.keyFindings.map((f) => bullet(f)),
            section("Competitive Landscape"),
            body(aiReport.competitorSummary),
            section("Recommendations"),
            recsTable(),
            section("Growth Roadmap"),
            ...aiReport.roadmap.flatMap((phase) => [
              subSection(phase.week),
              ...phase.actions.map((a) => bullet(a)),
            ]),
            section("Conclusion"),
            body(aiReport.conclusion),
            section("Recent Videos (Last 5)"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: ["Title", "Views", "Engagement"].map(
                    (h) =>
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22, color: "FFFFFF" })] })],
                        shading: { type: ShadingType.SOLID, color: titleColor },
                      })
                  ),
                }),
                ...videos.slice(0, 5).map(
                  (v, i) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: v.title, size: 20 })] })],
                          shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: "F8F7FF" } : undefined,
                        }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: compactNum(v.views), size: 20 })] })] }),
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: v.views > 0 ? ((((v.likes || 0) + (v.comments || 0)) / v.views) * 100).toFixed(2) + "%" : "—", size: 20 })] })],
                        }),
                      ],
                    })
                ),
              ],
            }),
            new Paragraph({ text: "", spacing: { before: 600 } }),
            new Paragraph({
              children: [new TextRun({ text: "— End of Report —", color: "9CA3AF", italics: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = `SocialPulse_Report_${channel.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_${now.toISOString().slice(0, 10)}.docx`;

    res.json({ docxBase64: base64, filename });
  } catch (err) {
    next(err);
  }
});

export default router;
