import {
  AiPreferences,
  AlertPreferences,
  NotificationPreferences,
  UserSettings,
  type IAiPreferences,
  type IAlertPreferences,
  type INotificationPreferences,
  type IUserSettings,
} from "@workspace/db";

// ── Defaults ────────────────────────────────────────────────────────────────
// Single source of truth for every setting. The frontend mirrors these in
// frontend/src/lib/prefs.ts — keep the two in sync.

export const AI_DEFAULTS: Omit<IAiPreferences, "userId" | "updatedAt"> = {
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

export const ALERT_DEFAULTS: Omit<IAlertPreferences, "userId" | "updatedAt"> = {
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

export const NOTIFICATION_DEFAULTS: Omit<INotificationPreferences, "userId" | "updatedAt"> = {
  channels: {
    inApp: true,
    email: false,
    browser: true,
    realtime: true,
  },
};

export const PROFILE_DEFAULTS: Omit<IUserSettings, "userId" | "updatedAt"> = {
  displayName: undefined,
  language: "en",
  theme: "dark",
  animations: true,
  timezone: undefined,
};

// ── Merging helpers ─────────────────────────────────────────────────────────

/** Recursively merge a stored value with defaults, keeping any user fields. */
function mergeWithDefaults<T extends Record<string, unknown>>(defaults: T, stored?: Partial<T> | null): T {
  if (!stored || typeof stored !== "object") return defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, def] of Object.entries(defaults)) {
    const val = (stored as Record<string, unknown>)[key];
    if (val === undefined || val === null) continue;
    if (def && typeof def === "object" && !Array.isArray(def) && val && typeof val === "object" && !Array.isArray(val)) {
      out[key] = mergeWithDefaults(def as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      out[key] = val;
    }
  }
  return out as T;
}

/** Shallow copy of a doc to a plain object (used before returning/merging). */
function plain(doc: { toObject?: () => Record<string, unknown> } | null | undefined): Record<string, unknown> {
  return doc ? (doc.toObject?.() ?? {}) : {};
}

// ── Read ────────────────────────────────────────────────────────────────────

export interface UserSettingsBundle {
  ai: ReturnType<typeof mergeWithDefaults<typeof AI_DEFAULTS>>;
  alerts: ReturnType<typeof mergeWithDefaults<typeof ALERT_DEFAULTS>>;
  notifications: ReturnType<typeof mergeWithDefaults<typeof NOTIFICATION_DEFAULTS>>;
  profile: ReturnType<typeof mergeWithDefaults<typeof PROFILE_DEFAULTS>>;
}

/** Load a user's full settings, filling every field with defaults on first run. */
export async function getSettings(userId: string): Promise<UserSettingsBundle> {
  const [ai, alerts, notifications, profile] = await Promise.all([
    AiPreferences.findOne({ userId }),
    AlertPreferences.findOne({ userId }),
    NotificationPreferences.findOne({ userId }),
    UserSettings.findOne({ userId }),
  ]);

  return {
    ai: mergeWithDefaults(AI_DEFAULTS, plain(ai) as Partial<typeof AI_DEFAULTS>),
    alerts: mergeWithDefaults(ALERT_DEFAULTS, plain(alerts) as Partial<typeof ALERT_DEFAULTS>),
    notifications: mergeWithDefaults(
      NOTIFICATION_DEFAULTS,
      plain(notifications) as Partial<typeof NOTIFICATION_DEFAULTS>,
    ),
    profile: mergeWithDefaults(PROFILE_DEFAULTS, plain(profile) as Partial<typeof PROFILE_DEFAULTS>),
  };
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * Persist a partial settings patch. Only the fields present in the patch are
 * written (upserted); everything else is left untouched. Returns the full
 * merged settings after the update.
 */
// Loose model type: the four settings models have different generic payloads but
// share the same `findOneAndUpdate` query shape, so a structural type keeps the
// upsert helper callable without a fragile union.
interface SettingsCollection {
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<unknown>;
}

export async function updateSettings(
  userId: string,
  patch: { ai?: Partial<typeof AI_DEFAULTS>; alerts?: Partial<typeof ALERT_DEFAULTS>; notifications?: Partial<typeof NOTIFICATION_DEFAULTS>; profile?: Partial<typeof PROFILE_DEFAULTS> },
): Promise<UserSettingsBundle> {
  const writes: Promise<unknown>[] = [];

  if (patch.ai && typeof patch.ai === "object") {
    writes.push(
      upsertPrefs(AiPreferences, userId, stripUndefined(patch.ai)),
    );
  }
  if (patch.alerts && typeof patch.alerts === "object") {
    writes.push(
      upsertPrefs(AlertPreferences, userId, stripUndefined(patch.alerts)),
    );
  }
  if (patch.notifications && typeof patch.notifications === "object") {
    writes.push(
      upsertPrefs(NotificationPreferences, userId, stripUndefined(patch.notifications)),
    );
  }
  if (patch.profile && typeof patch.profile === "object") {
    writes.push(
      upsertPrefs(UserSettings, userId, stripUndefined(patch.profile)),
    );
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }

  return getSettings(userId);
}

/**
 * Upsert a settings doc. Rapid consecutive toggles can fire several writes at
 * once; if two upserts race on the very first insert Mongo throws E11000 on the
 * loser. Retrying once as a plain update makes that safe.
 */
async function upsertPrefs(
  model: SettingsCollection,
  userId: string,
  fields: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await model.findOneAndUpdate(
      { userId },
      { $set: fields, $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (isDuplicateKey(err)) {
      return model.findOneAndUpdate(
        { userId },
        { $set: fields },
        { new: true },
      );
    }
    throw err;
  }
}

function isDuplicateKey(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000,
  );
}

/** Drop undefined keys so `$set` never overwrites a field with `undefined`. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}
