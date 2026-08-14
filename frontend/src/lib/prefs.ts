/**
 * Backward-compatibility shim.
 *
 * Settings are now persisted to MongoDB via /api/settings and served through
 * the global SettingsProvider (see lib/settings.ts). This module keeps the old
 * `Prefs` / `loadPrefs` names working for any remaining callers, sourcing the
 * values from the new canonical defaults — it no longer reads or writes
 * localStorage.
 */
import {
  AI_SETTINGS_DEFAULTS,
  ALERT_SETTINGS_DEFAULTS,
  PROFILE_SETTINGS_DEFAULTS,
  type AiSettings,
} from "@/lib/settings";

export type Prefs = AiSettings & {
  alertDrops: boolean;
  alertSpikes: boolean;
  alertConsistency: boolean;
  animations: boolean;
};

export const PREFS_DEFAULTS: Prefs = {
  ...AI_SETTINGS_DEFAULTS,
  alertDrops: ALERT_SETTINGS_DEFAULTS.youtube.videoPerformanceDrop,
  alertSpikes: ALERT_SETTINGS_DEFAULTS.youtube.growthSpike,
  alertConsistency: ALERT_SETTINGS_DEFAULTS.youtube.consistency,
  animations: PROFILE_SETTINGS_DEFAULTS.animations,
};

export const PREFS_KEY = "socialpulse:prefs";

/** Legacy accessor — returns defaults (DB-backed settings flow through the provider). */
export function loadPrefs(): Prefs {
  return PREFS_DEFAULTS;
}
