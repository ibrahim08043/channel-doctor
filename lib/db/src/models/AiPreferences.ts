import mongoose, { Schema, type Model } from "mongoose";

export type AiPersonality = "consultant" | "growthhacker" | "branding" | "coach" | "analyst";
export type AiStyle = "direct" | "detailed" | "executive" | "beginner" | "advanced";
export type AiDepth = "quick" | "standard" | "deep" | "enterprise";
export type AiResponseLength = "concise" | "balanced" | "detailed";
export type AiTone = "professional" | "casual" | "encouraging" | "direct";

export interface IAiPreferences {
  userId: string;
  // Core personality / framing
  aiPersonality: AiPersonality;
  aiStyle: AiStyle;
  aiDepth: AiDepth;
  aiCreativity: number;
  aiFocusAreas: string[];
  // Output tuning
  responseLength: AiResponseLength;
  tone: AiTone;
  // Automation toggles
  autoRecommendations: boolean;
  autoOptimization: boolean;
  autoAnalysis: boolean;
  // Reporting
  weeklyReports: boolean;
  monthlyReports: boolean;
  // Learning + suggestions
  learningMode: boolean;
  contentSuggestions: boolean;
  thumbnailSuggestions: boolean;
  seoSuggestions: boolean;
  // Prediction
  trendDetection: boolean;
  growthPrediction: boolean;
  updatedAt: Date;
}

type AiPreferencesModel = Model<IAiPreferences>;

const aiPreferencesSchema = new Schema<IAiPreferences, AiPreferencesModel>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    aiPersonality: { type: String, enum: ["consultant", "growthhacker", "branding", "coach", "analyst"], default: "consultant" },
    aiStyle: { type: String, enum: ["direct", "detailed", "executive", "beginner", "advanced"], default: "detailed" },
    aiDepth: { type: String, enum: ["quick", "standard", "deep", "enterprise"], default: "standard" },
    aiCreativity: { type: Number, min: 0, max: 100, default: 60 },
    aiFocusAreas: { type: [String], default: ["Growth", "Engagement"] },
    responseLength: { type: String, enum: ["concise", "balanced", "detailed"], default: "balanced" },
    tone: { type: String, enum: ["professional", "casual", "encouraging", "direct"], default: "professional" },
    autoRecommendations: { type: Boolean, default: true },
    autoOptimization: { type: Boolean, default: true },
    autoAnalysis: { type: Boolean, default: false },
    weeklyReports: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: false },
    learningMode: { type: Boolean, default: true },
    contentSuggestions: { type: Boolean, default: true },
    thumbnailSuggestions: { type: Boolean, default: true },
    seoSuggestions: { type: Boolean, default: true },
    trendDetection: { type: Boolean, default: true },
    growthPrediction: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    id: true,
    toJSON: {
      virtuals: true,
      transform(_doc: object, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const AiPreferences = mongoose.model<IAiPreferences, AiPreferencesModel>(
  "AiPreferences",
  aiPreferencesSchema,
);
