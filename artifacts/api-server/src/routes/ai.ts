import { Router, type IRouter } from "express";
import { jsonCompletion, visionJsonCompletion, openai } from "../services/openaiClient";
import { getVideo, getRecentVideos, getChannelRaw } from "../services/youtube";
import { deriveMetrics } from "../services/analysis";

const router: IRouter = Router();

router.post("/ai/title-optimizer", async (req, res, next) => {
  try {
    const { currentTitle, topic, channelTitle, audience } = req.body || {};
    if (!currentTitle && !topic) {
      res.status(400).json({ error: "currentTitle or topic required" });
      return;
    }
    const result = await jsonCompletion<{
      titles: { title: string; ctrScore: number; reasoning: string; style: string }[];
      analysis: string;
    }>(
      "You are a YouTube CTR optimization expert. Return strict JSON.",
      `Generate 10 highly clickable YouTube titles. For each, give a ctrScore 0-100, reasoning (1 sentence), and style (e.g. 'curiosity gap', 'list', 'how-to', 'shock', 'transformation').

Context:
- Current/working title: ${currentTitle || "(none)"}
- Topic: ${topic || "(infer from current title)"}
- Channel: ${channelTitle || "(not provided)"}
- Audience: ${audience || "(general)"}

Return JSON: { titles: [{title, ctrScore, reasoning, style}, ...10], analysis: '2 sentence overall analysis' }`,
      { temperature: 0.85 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ai/thumbnail-ab", async (req, res, next) => {
  try {
    const { thumbnailA, thumbnailB, title } = req.body || {};
    if (!thumbnailA || !thumbnailB) {
      res.status(400).json({ error: "thumbnailA and thumbnailB required" });
      return;
    }
    const result = await visionJsonCompletion<{
      winner: "A" | "B" | "tie";
      confidence: number;
      analysis: string;
      breakdown: {
        thumbnail: "A" | "B";
        ctrScore: number;
        clarity: number;
        emotion: number;
        contrast: number;
        textReadability: number;
        notes: string;
      }[];
    }>(
      "You are a YouTube thumbnail design expert. Return strict JSON. The two images are labelled A and B in order.",
      `Compare these two YouTube thumbnails for the video titled: "${title || "(untitled)"}".
Score each on ctrScore (0-100), clarity (0-100), emotion (0-100), contrast (0-100), textReadability (0-100), with notes.
Pick a winner ('A' | 'B' | 'tie') with confidence (0-100) and a 2-3 sentence overall analysis.

Return JSON: { winner, confidence, analysis, breakdown: [{thumbnail:'A',...},{thumbnail:'B',...}] }`,
      [thumbnailA, thumbnailB],
      { temperature: 0.4 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ai/retention-mapper", async (req, res, next) => {
  try {
    const { videoId, title, durationSeconds } = req.body || {};
    let dur = Number(durationSeconds || 0);
    let vTitle = String(title || "");
    if (videoId) {
      const v = await getVideo(String(videoId));
      if (v) {
        dur = v.durationSeconds;
        vTitle = v.title;
      }
    }
    if (!dur || !vTitle) {
      res.status(400).json({ error: "title + durationSeconds (or valid videoId) required" });
      return;
    }
    const result = await jsonCompletion<{
      summary: string;
      curve: { secondsIn: number; estimatedRetentionPct: number }[];
      dropoffs: { startSec: number; endSec: number; severity: "minor" | "major" | "critical"; cause: string; fix: string }[];
      hookAdvice: string;
    }>(
      "You are a YouTube retention specialist. Return strict JSON.",
      `Predict the audience retention curve for a video.
Title: "${vTitle}"
Duration seconds: ${dur}

Return JSON: {
  summary: '2 sentence overall retention prediction',
  curve: [{secondsIn:0, estimatedRetentionPct:100}, ... ~12 evenly spaced points to durationSeconds],
  dropoffs: [{startSec, endSec, severity, cause, fix}, ...3-5 most likely drop points],
  hookAdvice: 'specific hook restructure for the first 15 seconds'
}`,
      { temperature: 0.6 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ai/content-ideas", async (req, res, next) => {
  try {
    const { topic, channelTitle, audience } = req.body || {};
    if (!topic) {
      res.status(400).json({ error: "topic required" });
      return;
    }
    const result = await jsonCompletion<{
      ideas: { title: string; hook: string; format: string; why: string }[];
    }>(
      "You are a YouTube content strategist. Return strict JSON.",
      `Generate 8 fresh, search-worthy video ideas.
Topic/niche: ${topic}
Channel: ${channelTitle || "(unspecified)"}
Audience: ${audience || "(general)"}

Return JSON: { ideas: [{title, hook (1 sentence opening), format (e.g. tutorial/listicle/reaction/case-study), why (why this will perform)}, ...8] }`,
      { temperature: 0.9 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ai/why-failed", async (req, res, next) => {
  try {
    const { videoId, channelId } = req.body || {};
    if (!videoId) {
      res.status(400).json({ error: "videoId required" });
      return;
    }
    const v = await getVideo(String(videoId));
    if (!v) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    let avgChannelViews = 0;
    if (channelId) {
      const ch = await getChannelRaw(String(channelId));
      if (ch) {
        const recent = await getRecentVideos(ch.uploadsPlaylistId, 25);
        const others = recent.filter((r) => r.id !== v.id);
        if (others.length > 0) {
          avgChannelViews = Math.round(others.reduce((a, b) => a + b.views, 0) / others.length);
        }
      }
    }

    const result = await jsonCompletion<{
      verdict: string;
      gapVsAverage: number;
      reasons: { category: string; severity: "minor" | "major" | "critical"; explanation: string }[];
      fixes: { action: string; impact: string }[];
      titleAlternatives: string[];
    }>(
      "You are a YouTube performance forensic analyst. Return strict JSON.",
      `Analyze why this video underperformed.
Title: "${v.title}"
Views: ${v.views}, Likes: ${v.likes}, Comments: ${v.comments}, Duration: ${v.durationSeconds}s
Published: ${v.publishedAt}
Channel average views (recent): ${avgChannelViews || "(unknown)"}

Return JSON: {
  verdict: '2 sentence honest verdict',
  gapVsAverage: numeric (negative if below average, positive if above; expressed as percent of channel avg),
  reasons: [{category (e.g. Title, Thumbnail Hypothesis, Topic, Timing, Hook, SEO), severity, explanation}, ...3-5],
  fixes: [{action, impact}, ...3-5],
  titleAlternatives: [3 stronger titles]
}`,
      { temperature: 0.6 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ai/chat", async (req, res, next) => {
  try {
    const { message, channelId, history } = req.body || {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message required" });
      return;
    }
    let context = "";
    if (channelId) {
      try {
        const ch = await getChannelRaw(String(channelId));
        if (ch) {
          const vids = await getRecentVideos(ch.uploadsPlaylistId, 15);
          const m = deriveMetrics(ch, vids);
          context = `\n\nUser's channel context:
- Title: ${ch.title}
- Subscribers: ${ch.subscriberCount}
- Total views: ${ch.viewCount}
- Avg recent views: ${Math.round(m.avgViews)}
- Engagement rate: ${(m.engagementRate * 100).toFixed(2)}%
- Upload cadence: ${m.uploadCadencePerWeek.toFixed(2)}/week
- Recent video titles: ${vids.slice(0, 5).map((v) => `"${v.title}"`).join(", ")}`;
        }
      } catch {
        // graceful fallback
      }
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: `You are Doc, the AI growth coach inside Channel Doctor — a YouTube analytics SaaS. You speak like a sharp, no-fluff growth strategist. Keep answers under 200 words unless the user asks for depth. Use markdown lists when helpful. If the user asks something off-topic, gently steer them back to YouTube growth.${context}`,
      },
      ...((history || []) as { role: "user" | "assistant"; content: string }[])
        .slice(-8)
        .map((m) => ({ role: m.role, content: String(m.content || "") })),
      { role: "user", content: message },
    ];

    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages,
      });
      const reply = resp.choices[0]?.message?.content || "Sorry, I couldn't think of anything useful. Try rephrasing?";
      res.json({ reply });
    } catch (e) {
      res.json({
        reply:
          "I'm having trouble reaching the AI right now. Try again in a moment — your data is still safe.",
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
