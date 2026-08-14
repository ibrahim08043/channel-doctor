/**
 * Authoritative frontend settings model. Mirrors the backend defaults in
 * backend/src/services/settings.service.ts — keep the two in sync.
 *
 * Every field below is persisted to MongoDB via PUT /api/settings. The
 * frontend never stores settings in localStorage anymore (except an anonymous
 * fallback used only before first load / when signed out).
 */

// ── AI ──────────────────────────────────────────────────────────────────────

export type AiPersonality = "consultant" | "growthhacker" | "branding" | "coach" | "analyst";
export type AiStyle = "direct" | "detailed" | "executive" | "beginner" | "advanced";
export type AiDepth = "quick" | "standard" | "deep" | "enterprise";
export type AiResponseLength = "concise" | "balanced" | "detailed";
export type AiTone = "professional" | "casual" | "encouraging" | "direct";

export interface AiSettings {
  aiPersonality: AiPersonality;
  aiStyle: AiStyle;
  aiDepth: AiDepth;
  aiCreativity: number;
  aiFocusAreas: string[];
  responseLength: AiResponseLength;
  tone: AiTone;
  autoRecommendations: boolean;
  autoOptimization: boolean;
  autoAnalysis: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  learningMode: boolean;
  contentSuggestions: boolean;
  thumbnailSuggestions: boolean;
  seoSuggestions: boolean;
  trendDetection: boolean;
  growthPrediction: boolean;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export interface YoutubeAlerts {
  subscriberMilestones: boolean;
  subscriberDrop: boolean;
  videoPerformanceDrop: boolean;
  viralVideo: boolean;
  ctrDrop: boolean;
  retentionDrop: boolean;
  lowImpressions: boolean;
  monetization: boolean;
  copyright: boolean;
  consistency: boolean;
  growthSpike: boolean;
}

export interface InstagramAlerts {
  followerSpike: boolean;
  followerDrop: boolean;
  viralReel: boolean;
  engagementDrop: boolean;
}

export interface FacebookAlerts {
  postPerformance: boolean;
  pageGrowth: boolean;
  engagement: boolean;
}

export interface SystemAlerts {
  billing: boolean;
  aiQuota: boolean;
  storage: boolean;
  security: boolean;
}

export interface AlertSettings {
  youtube: YoutubeAlerts;
  instagram: InstagramAlerts;
  facebook: FacebookAlerts;
  system: SystemAlerts;
}

// ── Notification channels ───────────────────────────────────────────────────

export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
  browser: boolean;
  realtime: boolean;
}

export interface NotificationSettings {
  channels: NotificationChannels;
}

// ── Profile / app prefs ─────────────────────────────────────────────────────

export type ThemeMode = "dark" | "light";

export interface ProfileSettings {
  displayName?: string;
  language: string;
  theme: ThemeMode;
  animations: boolean;
  timezone?: string;
}

// ── Bundle ──────────────────────────────────────────────────────────────────

export interface UserSettings {
  ai: AiSettings;
  alerts: AlertSettings;
  notifications: NotificationSettings;
  profile: ProfileSettings;
}

export type SettingsPatch = Partial<{
  ai: Partial<AiSettings>;
  alerts: Partial<AlertSettings>;
  notifications: Partial<NotificationSettings>;
  profile: Partial<ProfileSettings>;
}>;

// ── Defaults (mirror backend/src/services/settings.service.ts) ──────────────

export const AI_SETTINGS_DEFAULTS: AiSettings = {
  aiPersonality: "consultant",
  aiStyle: "detailed",
  aiDepth: "standard",
  aiCreativity: 60,
  aiFocusAreas: ["Growth", "Engagement"],
  responseLength: "balanced",
  tone: "professional",
  autoRecommendations: true,
  autoOptimization: true,
  autoAnalysis: false,
  weeklyReports: true,
  monthlyReports: false,
  learningMode: true,
  contentSuggestions: true,
  thumbnailSuggestions: true,
  seoSuggestions: true,
  trendDetection: true,
  growthPrediction: true,
};

export const ALERT_SETTINGS_DEFAULTS: AlertSettings = {
  youtube: {
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
  },
  instagram: {
    followerSpike: true,
    followerDrop: true,
    viralReel: true,
    engagementDrop: true,
  },
  facebook: {
    postPerformance: true,
    pageGrowth: true,
    engagement: true,
  },
  system: {
    billing: true,
    aiQuota: true,
    storage: true,
    security: true,
  },
};

export const NOTIFICATION_SETTINGS_DEFAULTS: NotificationSettings = {
  channels: {
    inApp: true,
    email: false,
    browser: true,
    realtime: true,
  },
};

export const PROFILE_SETTINGS_DEFAULTS: ProfileSettings = {
  displayName: undefined,
  language: "en",
  theme: "dark",
  animations: true,
  timezone: undefined,
};

export const SETTINGS_DEFAULTS: UserSettings = {
  ai: AI_SETTINGS_DEFAULTS,
  alerts: ALERT_SETTINGS_DEFAULTS,
  notifications: NOTIFICATION_SETTINGS_DEFAULTS,
  profile: PROFILE_SETTINGS_DEFAULTS,
};

// ── Merge helpers ───────────────────────────────────────────────────────────

/** Deep-merge a partial settings bundle over defaults, filling every field. */
export function mergeSettings(partial?: Partial<UserSettings> | null): UserSettings {
  const base = SETTINGS_DEFAULTS;
  if (!partial) return base;
  return {
    ai: { ...base.ai, ...partial.ai },
    alerts: {
      youtube: { ...base.alerts.youtube, ...partial.alerts?.youtube },
      instagram: { ...base.alerts.instagram, ...partial.alerts?.instagram },
      facebook: { ...base.alerts.facebook, ...partial.alerts?.facebook },
      system: { ...base.alerts.system, ...partial.alerts?.system },
    },
    notifications: {
      channels: { ...base.notifications.channels, ...partial.notifications?.channels },
    },
    profile: { ...base.profile, ...partial.profile },
  };
}
