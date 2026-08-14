import type { Request, Response, NextFunction } from "express";
import { jsonCompletion, visionJsonCompletion, chatCompletion, FAST_MODEL, VISION_MODEL, type ChatMessage } from "../services/groq.service";
import { getVideo, getRecentVideos, getChannelRaw } from "../services/youtube.service";
import { deriveMetrics } from "../services/analysis.service";
import { getSettings } from "../services/settings.service";

// YouTube optimization endpoints use the fast model for high free-tier rate
// limits (the 70b model throttles hard at ~30 RPM → HTTP 429 under load).
const OPT = { model: FAST_MODEL };

/** Normalize an LLM-produced score to the 0–100 scale the UI expects.
 *  Accepts 0–1 fractions, 0–100 integers, or already-correct values. */
function normScore(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 1 && n >= 0) return Math.round(n * 100);
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function titleOptimizer(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentTitle, topic, channelTitle, audience } = req.body || {};
    if (!currentTitle && !topic) {
      res.status(400).json({ error: "currentTitle or topic required" }); return;
    }
    const result = await jsonCompletion<{
      titles: { title: string; ctrScore: number; reasoning: string; style: string }[];
      analysis: string;
    }>("You are a YouTube CTR optimization expert. Return strict JSON. All scores are integers 0-100.",
      `Generate 10 highly clickable YouTube titles.\nContext:\n- Current title: ${currentTitle || "(none)"}\n- Topic: ${topic || "(infer)"}\n- Channel: ${channelTitle || "(not provided)"}\n- Audience: ${audience || "(general)"}\nReturn JSON: { titles: [{title, ctrScore, reasoning, style}], analysis: string }`,
      { ...OPT, temperature: 0.85 });
    res.json({
      titles: result.titles.map((t) => ({ ...t, ctrScore: normScore(t.ctrScore) })),
      analysis: result.analysis,
    });
  } catch (err) { next(err); }
}

export async function thumbnailAb(req: Request, res: Response, next: NextFunction) {
  try {
    const { thumbnailA, thumbnailB, title } = req.body || {};
    if (!thumbnailA || !thumbnailB) { res.status(400).json({ error: "thumbnailA and thumbnailB required" }); return; }

    // The Groq vision model bills a fixed ~4550 tokens per image (independent
    // of dimensions) against an 8000 TPM limit, so TWO images in one request
    // always 413s on the free tier. We analyze each thumbnail in its own
    // single-image vision call, then run a text-only judge over the results.
    const analyzeOne = (label: "A" | "B", image: string) =>
      visionJsonCompletion<{
        ctrScore: number;
        clarity: number;
        emotion: number;
        contrast: number;
        textReadability: number;
        notes: string;
      }>(
        "You are a YouTube thumbnail design expert. Return strict JSON. All scores are integers 0-100.",
        `Analyze this single YouTube thumbnail for the video "${title || "(untitled)"}".
Evaluate:
- CTR prediction (0-100): how likely viewers click it in a feed
- Color analysis: contrast, saturation, color harmony, whether it pops against YouTube's dark UI
- Face detection: is a face present? expression quality? how big and well-framed is the face?
- Text readability: font size, legibility, word count, contrast with background
- Clarity and emotional impact
Return JSON: { ctrScore, clarity, emotion, contrast, textReadability, notes }. In "notes", explicitly mention the color palette, face presence/expression, and text readability.`,
        [image],
        { model: VISION_MODEL, temperature: 0.3 },
      );

    // Run both single-image analyses concurrently.
    const [analysisA, analysisB] = await Promise.all([
      analyzeOne("A", thumbnailA),
      analyzeOne("B", thumbnailB),
    ]);

    const normalize = (b: typeof analysisA, label: "A" | "B") => ({
      thumbnail: label,
      ctrScore: normScore(b.ctrScore),
      clarity: normScore(b.clarity),
      emotion: normScore(b.emotion),
      contrast: normScore(b.contrast),
      textReadability: normScore(b.textReadability),
      notes: typeof b.notes === "string" ? b.notes : "",
    });

    const breakdown = [normalize(analysisA, "A"), normalize(analysisB, "B")];

    // Text-only judge call picks the winner from the two analyzed breakdowns.
    const judge = await jsonCompletion<{
      winner: "A" | "B" | "tie"; confidence: number; analysis: string;
    }>(
      "You are a YouTube thumbnail A/B testing expert. Return strict JSON. confidence is 0-100.",
      `Two thumbnails were scored by a vision model. Video title: "${title || "(untitled)"}".
Thumbnail A: ${JSON.stringify(breakdown[0])}
Thumbnail B: ${JSON.stringify(breakdown[1])}
Pick the winner (A, B, or tie) with a 0-100 confidence and a short reasoning in "analysis" that explains which thumbnail will drive more clicks.`,
      { model: FAST_MODEL, temperature: 0.3 },
    );

    res.json({
      winner: judge.winner,
      confidence: normScore(judge.confidence),
      analysis: typeof judge.analysis === "string" ? judge.analysis : "Comparison complete.",
      breakdown,
    });
  } catch (err) { next(err); }
}

export async function retentionMapper(req: Request, res: Response, next: NextFunction) {
  try {
    const { videoId, title, durationSeconds } = req.body || {};
    let dur = Number(durationSeconds || 0);
    let vTitle = String(title || "");
    if (videoId) { const v = await getVideo(String(videoId)); if (v) { dur = v.durationSeconds; vTitle = v.title; } }
    if (!dur || !vTitle) { res.status(400).json({ error: "title + durationSeconds (or valid videoId) required" }); return; }
    const result = await jsonCompletion<{
      summary: string; curve: { secondsIn: number; estimatedRetentionPct: number }[];
      dropoffs: { startSec: number; endSec: number; severity: "minor" | "major" | "critical"; cause: string; fix: string }[];
      hookAdvice: string;
    }>("You are a YouTube retention specialist. Return strict JSON. estimatedRetentionPct is 0-100. summary and hookAdvice must be plain strings.",
      `Predict retention for "${vTitle}" (${dur}s).\nReturn JSON: { summary, curve: [{secondsIn, estimatedRetentionPct}...], dropoffs: [{startSec, endSec, severity, cause, fix}...], hookAdvice }`,
      { ...OPT, temperature: 0.6 });

    // Normalize types defensively: the model sometimes returns summary/hookAdvice
    // as objects or arrays, which crashes the frontend when rendered directly.
    const toStr = (v: unknown, fallback: string): string =>
      typeof v === "string" ? v
      : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n")
      : v && typeof v === "object" ? JSON.stringify(v)
      : fallback;

    res.json({
      summary: toStr(result.summary, "Retention analysis unavailable."),
      curve: (Array.isArray(result.curve) ? result.curve : []).map((p) => ({
        secondsIn: Math.max(0, Math.round(Number(p?.secondsIn) || 0)),
        estimatedRetentionPct: normScore(p?.estimatedRetentionPct, 100),
      })),
      dropoffs: (Array.isArray(result.dropoffs) ? result.dropoffs : []).map((d) => ({
        ...d,
        startSec: Math.max(0, Math.round(Number(d?.startSec) || 0)),
        endSec: Math.max(0, Math.round(Number(d?.endSec) || 0)),
        severity: ["minor", "major", "critical"].includes(d?.severity) ? d.severity : "major",
      })),
      hookAdvice: toStr(result.hookAdvice, "Hook advice unavailable."),
    });
  } catch (err) { next(err); }
}

export async function contentIdeas(req: Request, res: Response, next: NextFunction) {
  try {
    const { topic, channelTitle, audience } = req.body || {};
    if (!topic) { res.status(400).json({ error: "topic required" }); return; }
    const result = await jsonCompletion<{ ideas: { title: string; hook: string; format: string; why: string }[] }>(
      "You are a YouTube content strategist. Return strict JSON.",
      `Generate 8 video ideas for: ${topic}\nChannel: ${channelTitle || "N/A"}\nAudience: ${audience || "general"}\nReturn JSON: { ideas: [{title, hook, format, why}] }`,
      { ...OPT, temperature: 0.9 });
    res.json(result);
  } catch (err) { next(err); }
}

export async function whyFailed(req: Request, res: Response, next: NextFunction) {
  try {
    const { videoId, channelId } = req.body || {};
    if (!videoId) { res.status(400).json({ error: "videoId required" }); return; }
    const v = await getVideo(String(videoId));
    if (!v) { res.status(404).json({ error: "Video not found" }); return; }
    let avgChannelViews = 0;
    if (channelId) {
      const ch = await getChannelRaw(String(channelId));
      if (ch) { const recent = await getRecentVideos(ch.uploadsPlaylistId, 25); const others = recent.filter((r) => r.id !== v.id); if (others.length > 0) avgChannelViews = Math.round(others.reduce((a, b) => a + b.views, 0) / others.length); }
    }
    const result = await jsonCompletion<{
      verdict: string; gapVsAverage: number;
      reasons: { category: string; severity: "minor" | "major" | "critical"; explanation: string }[];
      fixes: { action: string; impact: string }[]; titleAlternatives: string[];
    }>("You are a YouTube performance analyst. Return strict JSON.",
      `Analyze why "${v.title}" underperformed.\nViews: ${v.views}, Likes: ${v.likes}, Comments: ${v.comments}, Duration: ${v.durationSeconds}s\nChannel avg: ${avgChannelViews || "unknown"}\nReturn JSON: { verdict, gapVsAverage, reasons: [{category, severity, explanation}...], fixes: [{action, impact}...], titleAlternatives: [3 stronger titles] }`,
      { ...OPT, temperature: 0.6 });
    res.json(result);
  } catch (err) { next(err); }
}

// ── YouTube optimization modules (real AI, no mocks) ─────────────────────────

export async function hookGenerator(req: Request, res: Response, next: NextFunction) {
  try {
    const { topic, channelTitle, audience, durationSeconds } = req.body || {};
    if (!topic) { res.status(400).json({ error: "topic required" }); return; }
    const result = await jsonCompletion<{
      hooks: { hook: string; score: number; type: string; reasoning: string }[];
    }>("You are a YouTube hook-writing specialist. Return strict JSON.",
      `Generate 8 high-retention opening hooks for a video about: ${topic}\nChannel: ${channelTitle || "N/A"}\nAudience: ${audience || "general"}\nTarget duration: ${durationSeconds ? `${durationSeconds}s` : "unknown"}\nReturn JSON: { hooks: [{hook, score (0-100), type, reasoning}] }`,
      { ...OPT, temperature: 0.85 });
    res.json(result);
  } catch (err) { next(err); }
}

export async function contentOptimizer(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, topic } = req.body || {};
    if (!title) { res.status(400).json({ error: "title required" }); return; }
    const result = await jsonCompletion<{
      optimizedTitle: string; hook: string; structure: string[];
      optimizedDescription: string; seoKeywords: string[]; ctrScore: number; summary: string;
    }>("You are a YouTube content optimization expert. Return strict JSON.",
      `Optimize this video for retention, SEO, and CTR.\nTitle: ${title}\nDescription: ${description || "(none)"}\nTopic: ${topic || "(infer from title)"}\nReturn JSON: { optimizedTitle, hook, structure: [key sections], optimizedDescription, seoKeywords: [8 keywords], ctrScore (0-100), summary }`,
      { ...OPT, temperature: 0.6 });
    res.json(result);
  } catch (err) { next(err); }
}

export async function seoOptimizer(req: Request, res: Response, next: NextFunction) {
  try {
    const { topic, title, channelTitle } = req.body || {};
    if (!topic && !title) { res.status(400).json({ error: "topic or title required" }); return; }
    const result = await jsonCompletion<{
      seoScore: number; keywords: { keyword: string; volume: string; difficulty: string; intent: string }[];
      suggestedTitle: string; suggestedDescription: string; suggestedTags: string[];
      gaps: string[]; analysis: string;
    }>("You are a YouTube SEO expert. Return strict JSON.",
      `Run a YouTube SEO audit for topic: ${topic || "(from title)"}.\nCurrent title: ${title || "(none)"}\nChannel: ${channelTitle || "N/A"}\nReturn JSON: { seoScore (0-100), keywords: [{keyword, volume, difficulty, intent}...8], suggestedTitle, suggestedDescription, suggestedTags: [15 tags], gaps: [missed SEO opportunities], analysis }`,
      { ...OPT, temperature: 0.5 });
    res.json(result);
  } catch (err) { next(err); }
}

export async function growthEngine(req: Request, res: Response, next: NextFunction) {
  try {
    const { channelId } = req.body || {};
    if (!channelId) { res.status(400).json({ error: "channelId required" }); return; }
    const ch = await getChannelRaw(String(channelId));
    if (!ch) { res.status(404).json({ error: "Channel not found" }); return; }
    const vids = await getRecentVideos(ch.uploadsPlaylistId, 25);
    const m = deriveMetrics(ch, vids);
    const result = await jsonCompletion<{
      growthScore: number;
      levers: { name: string; impact: "high" | "medium" | "low"; effort: "low" | "medium" | "high"; action: string }[];
      funnelGaps: string[];
      plan30: { day: string; action: string; expectedImpact: string }[];
      benchmarks: { metric: string; current: string; target: string }[];
    }>("You are a YouTube growth engine strategist. Return strict JSON.",
      `Build a growth engine for this channel.\nTitle: ${ch.title}\nSubs: ${ch.subscriberCount}\nAvg views: ${Math.round(m.avgViews)}\nCadence: ${m.uploadCadencePerWeek.toFixed(2)}/week\nEngagement: ${(m.engagementRate * 100).toFixed(2)}%\nGrowth ratio: ${m.growthRatio.toFixed(2)}\nReturn JSON: { growthScore (0-100), levers: [{name, impact, effort, action}...6], funnelGaps: [4], plan30: [{day, action, expectedImpact}...7], benchmarks: [{metric, current, target}...5] }`,
      { ...OPT, temperature: 0.55 });
    res.json({ channelId: ch.id, channelTitle: ch.title, ...result });
  } catch (err) { next(err); }
}

export async function aiChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, channelId, history } = req.body || {};
    if (!message || typeof message !== "string") { res.status(400).json({ error: "message required" }); return; }

    // Live AI preferences from the database (defaults when never saved).
    // These directly shape behavior: persona, tone, verbosity, creativity, and
    // whether suggestions/analysis context is included at all.
    const ai = (await getSettings((req as { userId?: string }).userId ?? "anon").catch(() => null))?.ai;

    let context = "";
    if (channelId) {
      try {
        const ch = await getChannelRaw(String(channelId));
        if (ch) { const vids = await getRecentVideos(ch.uploadsPlaylistId, 15); const m = deriveMetrics(ch, vids);
          context = `\n\nUser's channel context:\n- Title: ${ch.title}\n- Subscribers: ${ch.subscriberCount}\n- Total views: ${ch.viewCount}\n- Avg recent views: ${Math.round(m.avgViews)}\n- Engagement rate: ${(m.engagementRate * 100).toFixed(2)}%\n- Upload cadence: ${m.uploadCadencePerWeek.toFixed(2)}/week`; }
      } catch {}
    }

    // ── Preferences → prompt directives ─────────────────────────────────────
    const personaMap: Record<string, string> = {
      consultant: "You are a strategic consultant — professional, executive-level insights with measurable impact.",
      growthhacker: "You are a growth hacker — aggressive, viral-first tactics. Bold, fast, and provocative.",
      branding: "You are a branding expert — every recommendation through the lens of brand equity.",
      coach: "You are a content coach — encouraging, educational, community-first guidance.",
      analyst: "You are a data analyst — numbers-first, benchmarks, data, and evidence for everything.",
    };
    const toneMap: Record<string, string> = {
      professional: "Use a professional, polished tone.",
      casual: "Use a casual, friendly tone.",
      encouraging: "Use an encouraging, supportive tone.",
      direct: "Use a direct, no-nonsense tone.",
    };
    const lengthMap: Record<string, string> = {
      concise: "Keep answers very short — under 100 words.",
      balanced: "Keep answers balanced — around 150-200 words.",
      detailed: "Be thorough and detailed — up to 400 words.",
    };

    const persona = personaMap[ai?.aiPersonality ?? "consultant"] ?? personaMap.consultant;
    const tone = toneMap[ai?.tone ?? "professional"] ?? toneMap.professional;
    const length = lengthMap[ai?.responseLength ?? "balanced"] ?? lengthMap.balanced;
    const creativity = Math.round(ai?.aiCreativity ?? 60);

    let prefsDirectives = `${persona} ${tone} ${length}`;
    if (ai?.aiFocusAreas?.length) {
      prefsDirectives += `\nPrioritize these focus areas: ${ai.aiFocusAreas.join(", ")}.`;
    }
    // Toggles that gate extra capability in chat replies.
    if (ai?.contentSuggestions === false) prefsDirectives += "\nDo NOT include content/video ideas unless asked.";
    if (ai?.seoSuggestions === false) prefsDirectives += "\nDo NOT include SEO keyword suggestions unless asked.";
    if (ai?.growthPrediction === false) prefsDirectives += "\nDo NOT make numerical growth predictions.";

    const msgs: ChatMessage[] = [
      { role: "system", content: `You are Doc, the AI growth coach inside Channel Doctor. Use markdown.${context}\n\nAI preferences (hard directives):\n${prefsDirectives}` },
      ...((history || []) as { role: "user" | "assistant"; content: string }[]).slice(-8).map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: message },
    ];
    try {
      const reply = await chatCompletion(msgs, { model: FAST_MODEL, temperature: creativity / 100, maxTokens: 1024 });
      res.json({ reply: reply || "Sorry, I couldn't think of anything useful." });
    } catch {
      res.json({ reply: "I'm having trouble reaching the AI right now. Try again." });
    }
  } catch (err) { next(err); }
}
