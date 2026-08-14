import { structuredCompletion, FAST_MODEL } from "./groq.service";
import { logger } from "../lib/logger";

/**
 * ── Instagram / Facebook AI analyzer ─────────────────────────────────────────
 * The frontend (SocialAnalyzer.tsx) renders a rich, nested result:
 *
 *   SocialAnalysisResult {
 *     platform, handle, overallScore, headline, summary,
 *     categories[], strategies[], quickWins[], disclaimer,
 *     instagramInsights? | facebookInsights?
 *   }
 *
 * A single LLM call that tries to produce ALL of that at once routinely fails
 * (truncation / missing nested keys), so the previous implementation returned
 * an empty result and the UI showed nothing. This service splits the work into
 * several small, focused structured-output calls (run in parallel) and merges
 * them into exactly the schema the frontend expects. Each call uses Groq's
 * strict JSON-schema mode, so the returned shape is guaranteed.
 */

// ── Section result types ────────────────────────────────────────────────────
// Each focused LLM call resolves to one of these. `runTasks` intentionally
// returns `unknown` so the heterogeneous results are cast back to these at the
// destructure site.

interface IGOverview {
  overallScore: number; headline: string; summary: string;
  categories: { name: string; score: number; notes: string }[];
  strategies: { title: string; reason: string; impact: string; steps: string[] }[];
  quickWins: string[];
}
interface IGProfile {
  usernameScore: number;
  usernameAlts: { handle: string; reason: string }[];
  profileBrandingScore: number;
  profileNotes: string;
  bioScore: number;
  bioIssues: string[];
  bioVersions: { type: string; bio: string; reasoning: string }[];
}
interface IGContent {
  contentPillars: { name: string; percentage: number; strength: string }[];
  weakTopics: string[];
  overusedTopics: string[];
  reelScore: number;
  hookScore: number;
  viralProbability: number;
  reelRecommendations: string[];
}
interface IGCaptions {
  captionScore: number;
  improvedCaptions: string[];
  hashtagScore: number;
  hashtagClusters: { name: string; hashtags: string[]; strength: string }[];
}
interface IGEngagement {
  engagementTrend: string;
  strongCategories: string[];
  engagementActions: string[];
}
interface FacebookInsightsResult {
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
}

// ── JSON Schema helpers (strict mode) ────────────────────────────────────────

const str = (description?: string) => ({ type: "string" as const, ...(description ? { description } : {}) });
const int = (min: number, max: number, description?: string) => ({
  type: "integer" as const,
  minimum: min,
  maximum: max,
  ...(description ? { description } : {}),
});
const strArr = (description?: string) => ({ type: "array" as const, items: { type: "string" as const }, ...(description ? { description } : {}) });

const overviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "headline", "summary", "categories", "strategies", "quickWins"],
  properties: {
    overallScore: int(0, 100, "Overall 0-100 health score"),
    headline: str("1-2 line punchy headline"),
    summary: str("2-3 sentence executive summary"),
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "notes"],
        properties: {
          name: str(),
          score: int(0, 100),
          notes: str(),
        },
      },
    },
    strategies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "impact", "steps"],
        properties: {
          title: str(),
          reason: str(),
          impact: str(),
          steps: strArr(),
        },
      },
    },
    quickWins: strArr("3-5 quick wins to do today"),
  },
};

const instagramProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "usernameScore", "usernameAlts", "profileBrandingScore", "profileNotes",
    "bioScore", "bioIssues", "bioVersions",
  ],
  properties: {
    usernameScore: int(0, 100),
    usernameAlts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["handle", "reason"],
        properties: { handle: str(), reason: str() },
      },
    },
    profileBrandingScore: int(0, 100),
    profileNotes: str(),
    bioScore: int(0, 100),
    bioIssues: strArr(),
    bioVersions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "bio", "reasoning"],
        properties: { type: str(), bio: str(), reasoning: str() },
      },
    },
  },
};

const instagramContentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contentPillars", "weakTopics", "overusedTopics",
    "reelScore", "hookScore", "viralProbability", "reelRecommendations",
  ],
  properties: {
    contentPillars: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "percentage", "strength"],
        properties: { name: str(), percentage: int(0, 100), strength: str() },
      },
    },
    weakTopics: strArr(),
    overusedTopics: strArr(),
    reelScore: int(0, 100),
    hookScore: int(0, 100),
    viralProbability: int(0, 100),
    reelRecommendations: strArr(),
  },
};

const instagramCaptionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["captionScore", "improvedCaptions", "hashtagScore", "hashtagClusters"],
  properties: {
    captionScore: int(0, 100),
    improvedCaptions: strArr("3 rewritten captions, hook-first / storytelling / question-driven"),
    hashtagScore: int(0, 100),
    hashtagClusters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hashtags", "strength"],
        properties: { name: str(), hashtags: strArr(), strength: str() },
      },
    },
  },
};

const instagramEngagementSchema = {
  type: "object",
  additionalProperties: false,
  required: ["engagementTrend", "strongCategories", "engagementActions"],
  properties: {
    engagementTrend: str("growing | declining | stable"),
    strongCategories: strArr(),
    engagementActions: strArr(),
  },
};

const facebookInsightsSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "pageTitleScore", "pageDescScore", "brandingImprovements", "bestFormats",
    "recommendedFrequency", "topPostTypes", "engagementOpportunities",
    "interactionStrategy", "roadmap30", "roadmap60", "roadmap90",
  ],
  properties: {
    pageTitleScore: int(0, 100),
    pageDescScore: int(0, 100),
    brandingImprovements: strArr(),
    bestFormats: strArr(),
    recommendedFrequency: str("e.g. '4-5 posts per week, 1 live per month'"),
    topPostTypes: strArr(),
    engagementOpportunities: strArr(),
    interactionStrategy: str(),
    roadmap30: roadmapPhaseSchema(),
    roadmap60: roadmapPhaseSchema(),
    roadmap90: roadmapPhaseSchema(),
  },
};

function roadmapPhaseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["focus", "actions", "kpis"],
    properties: {
      focus: str(),
      actions: strArr(),
      kpis: strArr(),
    },
  };
}

// ── Personas & depth ─────────────────────────────────────────────────────────

const PERSONALITY_SYSTEM: Record<string, string> = {
  consultant: "You are a senior social media strategist at a top-tier management consulting firm.",
  growthhacker: "You are an aggressive growth hacker obsessed with viral mechanics.",
  branding: "You are a brand identity expert with deep expertise in visual storytelling.",
  coach: "You are an encouraging but honest content coach.",
  analyst: "You are a data-driven social media analyst who backs every recommendation with benchmarks.",
};

const DEPTH_INSTRUCTIONS: Record<string, string> = {
  quick: "Be concise and high-impact. 2-3 sentences per section.",
  standard: "Be thorough. 3-4 sentences per section, 5 items per list.",
  deep: "Exhaustive consulting-grade analysis. Full paragraphs.",
  enterprise: "Board-level data-rich analysis. Every insight includes why it matters.",
};

export interface SocialAnalyzerParams {
  platform: "instagram" | "facebook";
  handle: string;
  personality?: string;
  depth?: string;
  creativity?: number;
  focusAreas?: string[];
}

export interface SocialAnalysisResult {
  platform: string;
  handle: string;
  overallScore: number;
  headline: string;
  summary: string;
  categories: { name: string; score: number; notes: string }[];
  strategies: { title: string; reason: string; impact: string; steps: string[] }[];
  quickWins: string[];
  disclaimer: string;
  instagramInsights?: {
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
  facebookInsights?: {
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
}

/**
 * Run a list of LLM calls with a limited concurrency pool, capturing
 * individual failures so one bad call can't fail the entire analysis.
 *
 * Groq's free tier caps concurrent requests: firing all 5 section calls at
 * once triggers HTTP 429 / request queuing that made earlier parallel builds
 * drop whole sections. Fully sequential calls are too slow (~60s+). A small
 * pool (default 2) keeps wall-time down to ~25-35s while staying under the
 * concurrency limit. Each call also retries internally on 429 (groq.service
 * `withRetry`).
 *
 * `timeoutMs` (default 60s) aborts a stuck call so the endpoint can never
 * hang indefinitely — the request loop has no other deadline.
 */
type TaskResult = unknown;

async function runTasks(
  tasks: Array<() => Promise<TaskResult>>,
  { timeoutMs = 60000, concurrency = 2 }: { timeoutMs?: number; concurrency?: number } = {},
): Promise<Array<TaskResult | null>> {
  const results: Array<TaskResult | null> = new Array(tasks.length).fill(null);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) return;
      const task = tasks[index];

      const outcome = await new Promise<TaskResult | null>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          logger.warn({ timeoutMs }, "social analyzer: a call timed out, continuing");
          resolve(null);
        }, timeoutMs);
        task()
          .then((value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          })
          .catch((err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            logger.warn({ err: (err as Error).message }, "social analyzer: one call failed, continuing");
            resolve(null);
          });
      });

      results[index] = outcome;
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function analyzeSocial(params: SocialAnalyzerParams): Promise<SocialAnalysisResult> {
  const { platform, handle } = params;
  const h = handle.replace(/^@/, "");
  const persona = PERSONALITY_SYSTEM[params.personality ?? ""] ?? PERSONALITY_SYSTEM.consultant;
  const depth = DEPTH_INSTRUCTIONS[params.depth ?? ""] ?? DEPTH_INSTRUCTIONS.standard;
  const focus = params.focusAreas?.length
    ? `\nThe client specifically asked us to prioritise: ${params.focusAreas.join(", ")}.`
    : "";

  const baseSystem = `${persona} ${depth} Return only valid JSON.${focus}`;

  if (platform === "instagram") {
    // Each section is a separate focused call, run in parallel. Per-call
    // failures are captured (null) so one bad section never blanks the result.
    const [overview, profile, content, captions, engagement] = (await runTasks([
      () => structuredCompletion<{
        overallScore: number; headline: string; summary: string;
        categories: { name: string; score: number; notes: string }[];
        strategies: { title: string; reason: string; impact: string; steps: string[] }[];
        quickWins: string[];
      }>("instagram_overview", overviewSchema,
        baseSystem,
        `Perform a comprehensive Instagram audit on @${h}.\nCover: overall 0-100 score, punchy headline, 2-3 sentence summary, 4-6 category scores (e.g. Profile, Content, Engagement, Growth, Monetization), 4 growth strategies (each with title/reason/impact/steps), and 4-5 quick wins. Be specific to a ${h}-style creator.`, { model: FAST_MODEL }),
      () => structuredCompletion<{
        usernameScore: number;
        usernameAlts: { handle: string; reason: string }[];
        profileBrandingScore: number;
        profileNotes: string;
        bioScore: number;
        bioIssues: string[];
        bioVersions: { type: string; bio: string; reasoning: string }[];
      }>("instagram_profile", instagramProfileSchema,
        baseSystem,
        `Audit the Instagram profile & bio of @${h}.\nEvaluate the username (memorability, brandability, searchability) with 4 alternative handles, profile branding, and bio. Provide bioScore (0-100), 3-5 bioIssues, and 3 rewritten bios (type e.g. 'Hook-first', 'Authority', 'Search-optimized') each with reasoning.`, { model: FAST_MODEL }),
      () => structuredCompletion<{
        contentPillars: { name: string; percentage: number; strength: string }[];
        weakTopics: string[];
        overusedTopics: string[];
        reelScore: number;
        hookScore: number;
        viralProbability: number;
        reelRecommendations: string[];
      }>("instagram_content", instagramContentSchema,
        baseSystem,
        `Analyze the content mix of @${h}.\nList 4-5 content pillars (percentages must sum to ~100) with strength (strong/weak/overused), weak topics, overused topics, reel score (0-100), hook score (0-100), viral probability (0-100), and 4-5 specific reel recommendations.`, { model: FAST_MODEL }),
      () => structuredCompletion<{
        captionScore: number;
        improvedCaptions: string[];
        hashtagScore: number;
        hashtagClusters: { name: string; hashtags: string[]; strength: string }[];
      }>("instagram_captions", instagramCaptionsSchema,
        baseSystem,
        `Audit the caption & hashtag strategy of @${h}.\nScore captions (0-100), provide 3 rewritten captions (hook-first / storytelling / question-driven), score hashtag usage (0-100), and give 3 hashtag clusters (each with a name, 8-12 real hashtags, strength high/medium/low).`, { model: FAST_MODEL }),
      () => structuredCompletion<{
        engagementTrend: string;
        strongCategories: string[];
        engagementActions: string[];
      }>("instagram_engagement", instagramEngagementSchema,
        baseSystem,
        `Evaluate engagement for @${h}.\nState the engagement trend (growing/declining/stable), 4-6 strong performing categories, and 4-6 concrete actions to boost engagement.`, { model: FAST_MODEL }),
    ])) as [
      IGOverview | null,
      IGProfile | null,
      IGContent | null,
      IGCaptions | null,
      IGEngagement | null,
    ];

    const disclaimers = [
      "AI-estimated based on general platform patterns.",
      `Deep-dive scored from training knowledge of Instagram's algorithm; live API data isn't available for public profiles without the Instagram Graph API.`,
    ];

    return {
      platform: "instagram",
      handle: h,
      overallScore: overview?.overallScore ?? 0,
      headline: overview?.headline ?? `Instagram audit for @${h}`,
      summary: overview?.summary ?? `Comprehensive AI analysis of @${h}'s Instagram presence.`,
      categories: overview?.categories ?? [],
      strategies: overview?.strategies ?? [],
      quickWins: overview?.quickWins ?? [],
      disclaimer: disclaimers[0],
      instagramInsights: {
        usernameScore: profile?.usernameScore ?? 0,
        usernameAlts: profile?.usernameAlts ?? [],
        profileBrandingScore: profile?.profileBrandingScore ?? 0,
        profileNotes: profile?.profileNotes ?? "",
        bioScore: profile?.bioScore ?? 0,
        bioIssues: profile?.bioIssues ?? [],
        bioVersions: profile?.bioVersions ?? [],
        contentPillars: content?.contentPillars ?? [],
        weakTopics: content?.weakTopics ?? [],
        overusedTopics: content?.overusedTopics ?? [],
        reelScore: content?.reelScore ?? 0,
        hookScore: content?.hookScore ?? 0,
        viralProbability: content?.viralProbability ?? 0,
        reelRecommendations: content?.reelRecommendations ?? [],
        captionScore: captions?.captionScore ?? 0,
        improvedCaptions: captions?.improvedCaptions ?? [],
        hashtagScore: captions?.hashtagScore ?? 0,
        hashtagClusters: captions?.hashtagClusters ?? [],
        engagementTrend: engagement?.engagementTrend ?? "stable",
        strongCategories: engagement?.strongCategories ?? [],
        engagementActions: engagement?.engagementActions ?? [],
      },
    };
  }

  // ── Facebook ───────────────────────────────────────────────────────────────
  // Two focused calls, run in parallel (each retries internally on 429).
  const [overview, insights] = (await runTasks([
    () => structuredCompletion<{
      overallScore: number; headline: string; summary: string;
      categories: { name: string; score: number; notes: string }[];
      strategies: { title: string; reason: string; impact: string; steps: string[] }[];
      quickWins: string[];
    }>("facebook_overview", overviewSchema,
      baseSystem,
      `Perform a comprehensive Facebook page audit on "${h}".\nCover: overall 0-100 score, punchy headline, 2-3 sentence summary, 4-6 category scores (e.g. Page Profile, Content, Engagement, Audience, Growth), 4 growth strategies, and 4-5 quick wins.`,
      { model: FAST_MODEL }),
    () => structuredCompletion<{
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
    }>("facebook_insights", facebookInsightsSchema,
      baseSystem,
      `Deep-dive the Facebook page "${h}".\nScore the page title (0-100) and description (0-100), list 3-5 branding improvements, best content formats, a recommended posting frequency, top post types, engagement opportunities, an interaction strategy, and a 30/60/90 day roadmap (each with focus, 4-6 actions, and 3-4 KPIs).`,
      { model: FAST_MODEL }),
  ])) as [IGOverview | null, FacebookInsightsResult | null];

  return {
    platform: "facebook",
    handle: h,
    overallScore: overview?.overallScore ?? 0,
    headline: overview?.headline ?? `Facebook audit for ${h}`,
    summary: overview?.summary ?? `Comprehensive AI analysis of "${h}"'s Facebook presence.`,
    categories: overview?.categories ?? [],
    strategies: overview?.strategies ?? [],
    quickWins: overview?.quickWins ?? [],
    disclaimer: "AI-estimated based on general platform patterns.",
    facebookInsights: {
      pageTitleScore: insights?.pageTitleScore ?? 0,
      pageDescScore: insights?.pageDescScore ?? 0,
      brandingImprovements: insights?.brandingImprovements ?? [],
      bestFormats: insights?.bestFormats ?? [],
      recommendedFrequency: insights?.recommendedFrequency ?? "3-4 posts per week",
      topPostTypes: insights?.topPostTypes ?? [],
      engagementOpportunities: insights?.engagementOpportunities ?? [],
      interactionStrategy: insights?.interactionStrategy ?? "",
      roadmap30: insights?.roadmap30 ?? { focus: "Foundation", actions: [], kpis: [] },
      roadmap60: insights?.roadmap60 ?? { focus: "Growth", actions: [], kpis: [] },
      roadmap90: insights?.roadmap90 ?? { focus: "Scale", actions: [], kpis: [] },
    },
  };
}
