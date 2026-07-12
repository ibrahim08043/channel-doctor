export type Prefs = {
  aiPersonality: "consultant" | "growthhacker" | "branding" | "coach" | "analyst";
  aiStyle: "direct" | "detailed" | "executive" | "beginner" | "advanced";
  aiDepth: "quick" | "standard" | "deep" | "enterprise";
  aiCreativity: number;
  aiFocusAreas: string[];
  alertDrops: boolean;
  alertSpikes: boolean;
  alertConsistency: boolean;
  animations: boolean;
};

export const PREFS_DEFAULTS: Prefs = {
  aiPersonality: "consultant",
  aiStyle: "detailed",
  aiDepth: "standard",
  aiCreativity: 60,
  aiFocusAreas: ["Growth", "Engagement"],
  alertDrops: true,
  alertSpikes: true,
  alertConsistency: true,
  animations: true,
};

export const PREFS_KEY = "socialpulse:prefs";

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_DEFAULTS;
    return { ...PREFS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return PREFS_DEFAULTS;
  }
}
