import type { Request, Response, NextFunction } from "express";
import { getUserId, ensureUser } from "../middleware/auth";
import { AlertPreferences, User } from "@workspace/db";
import { getChannelRaw, getRecentVideos } from "../services/youtube.service";
import { deriveMetrics } from "../services/analysis.service";
import { createNotification, hasRecentNotification } from "../services/notification.service";
import type { NotificationType } from "@workspace/db";

interface ComputedAlert {
  type: NotificationType;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  /** alert_preferences.youtube key that gates this alert (if any). */
  prefKey?: keyof typeof DEFAULT_YT_PREFS;
}

const DEFAULT_YT_PREFS = {
  subscriberMilestones: true,
  subscriberDrop: true,
  videoPerformanceDrop: true,
  viralVideo: true,
  ctrDrop: true,
  retentionDrop: true,
  lowImpressions: false,
  monetization: true,
  copyright: true,
  consistency: true,
  growthSpike: true,
} as const;

/**
 * POST /api/notifications/scan
 *
 * Re-checks the user's connected channel against a set of growth alerts and
 * creates + pushes a notification for every alert whose corresponding toggle is
 * ON in alert_preferences. Alerts are deduped (one per type per 6h) so the scan
 * is safe to call on a schedule or from the UI.
 */
export async function scanForAlertsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const user = await ensureUser(userId);

    if (!user.channelId) {
      res.json({ items: [], unread: 0, skipped: 0, reason: "no_channel" });
      return;
    }

    const prefsDoc = await AlertPreferences.findOne({ userId }).lean();
    const ytPrefs = { ...DEFAULT_YT_PREFS, ...(prefsDoc?.youtube ?? {}) } as Record<string, boolean>;
    const systemPrefs = { billing: true, aiQuota: true, storage: true, security: true, ...(prefsDoc?.system ?? {}) } as Record<string, boolean>;

    const channel = await getChannelRaw(user.channelId);
    if (!channel) {
      res.json({ items: [], unread: 0, skipped: 0, reason: "channel_unavailable" });
      return;
    }
    const videos = await getRecentVideos(channel.uploadsPlaylistId, 25);
    const m = deriveMetrics(channel, videos);

    const computed: ComputedAlert[] = [];

    // Consistency / cadence
    if (m.uploadCadencePerWeek < 0.5) {
      computed.push({ type: "consistency", severity: "critical", title: "Posting frequency dropped", description: `Averaging ${m.uploadCadencePerWeek.toFixed(2)} uploads/week.`, prefKey: "consistency" });
    } else if (m.uploadCadencePerWeek < 1) {
      computed.push({ type: "consistency", severity: "warning", title: "Cadence below threshold", description: `${m.uploadCadencePerWeek.toFixed(2)}/week — aim for 1+.`, prefKey: "consistency" });
    }

    // Underperforming streak → video performance drop
    const recent3 = videos.slice(0, 3);
    if (recent3.length === 3) {
      const avg = recent3.reduce((s, v) => s + v.views, 0) / 3;
      if (avg < m.avgViews * 0.6) {
        computed.push({ type: "video_performance_drop", severity: "warning", title: "Last 3 videos underperformed", description: `Avg ${Math.round(avg)} views vs ${Math.round(m.avgViews)} channel avg.`, prefKey: "videoPerformanceDrop" });
      }
    }

    // Growth trending down
    if (m.growthRatio < 0.7 && videos.length >= 8) {
      computed.push({ type: "subscriber_drop", severity: "critical", title: "Views trending down", description: `Growth ratio ${m.growthRatio.toFixed(2)}x.`, prefKey: "subscriberDrop" });
    }

    // Low engagement
    if (m.engagementRate < 0.01 && videos.length > 0) {
      computed.push({ type: "engagement_drop", severity: "warning", title: "Low engagement", description: `${(m.engagementRate * 100).toFixed(2)}% engagement.`, prefKey: "ctrDrop" });
    }

    // Viral video detection — any video > 3x the channel average
    if (videos.length >= 5) {
      const viral = videos.find((v) => v.views >= m.avgViews * 3 && v.views > 1000);
      if (viral) {
        computed.push({ type: "viral_video", severity: "info", title: "Viral video detected", description: `"${viral.title}" is at ${viral.views.toLocaleString()} views (${Math.round(viral.views / m.avgViews)}x avg).`, prefKey: "viralVideo" });
      }
    }

    // System alert: AI quota (conservative nudge when quota env is low)
    if (systemPrefs.aiQuota && process.env.GROQ_API_KEY && process.env.GROQ_QUOTA_THRESHOLD === "true") {
      computed.push({ type: "ai_quota", severity: "warning", title: "AI quota running low", description: "Consider upgrading your AI plan to keep analyses flowing.", prefKey: undefined });
    }

    let created = 0;
    let skipped = 0;
    for (const alert of computed) {
      if (alert.prefKey && !ytPrefs[alert.prefKey]) {
        skipped += 1;
        continue;
      }
      if (await hasRecentNotification(userId, alert.type)) {
        skipped += 1;
        continue;
      }
      await createNotification(userId, {
        type: alert.type,
        title: alert.title,
        body: alert.description,
        severity: alert.severity,
        data: { metric: m, scan: true },
      });
      created += 1;
    }

    const { listNotifications } = await import("../services/notification.service");
    const result = await listNotifications(userId);
    res.json({ ...result, created, skipped });
  } catch (err) {
    next(err);
  }
}
