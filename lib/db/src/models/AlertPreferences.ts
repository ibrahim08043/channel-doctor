import mongoose, { Schema, type Model } from "mongoose";

export interface IYouTubeAlerts {
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

export interface IInstagramAlerts {
  followerSpike: boolean;
  followerDrop: boolean;
  viralReel: boolean;
  engagementDrop: boolean;
}

export interface IFacebookAlerts {
  postPerformance: boolean;
  pageGrowth: boolean;
  engagement: boolean;
}

export interface ISystemAlerts {
  billing: boolean;
  aiQuota: boolean;
  storage: boolean;
  security: boolean;
}

export interface IAlertPreferences {
  userId: string;
  youtube: IYouTubeAlerts;
  instagram: IInstagramAlerts;
  facebook: IFacebookAlerts;
  system: ISystemAlerts;
  updatedAt: Date;
}

type AlertPreferencesModel = Model<IAlertPreferences>;

const youtubeAlertsSchema = new Schema<IYouTubeAlerts>(
  {
    subscriberMilestones: { type: Boolean, default: true },
    subscriberDrop: { type: Boolean, default: true },
    videoPerformanceDrop: { type: Boolean, default: true },
    viralVideo: { type: Boolean, default: true },
    ctrDrop: { type: Boolean, default: true },
    retentionDrop: { type: Boolean, default: true },
    lowImpressions: { type: Boolean, default: false },
    monetization: { type: Boolean, default: true },
    copyright: { type: Boolean, default: true },
    consistency: { type: Boolean, default: true },
    growthSpike: { type: Boolean, default: true },
  },
  { _id: false },
);

const instagramAlertsSchema = new Schema<IInstagramAlerts>(
  {
    followerSpike: { type: Boolean, default: true },
    followerDrop: { type: Boolean, default: true },
    viralReel: { type: Boolean, default: true },
    engagementDrop: { type: Boolean, default: true },
  },
  { _id: false },
);

const facebookAlertsSchema = new Schema<IFacebookAlerts>(
  {
    postPerformance: { type: Boolean, default: true },
    pageGrowth: { type: Boolean, default: true },
    engagement: { type: Boolean, default: true },
  },
  { _id: false },
);

const systemAlertsSchema = new Schema<ISystemAlerts>(
  {
    billing: { type: Boolean, default: true },
    aiQuota: { type: Boolean, default: true },
    storage: { type: Boolean, default: true },
    security: { type: Boolean, default: true },
  },
  { _id: false },
);

const alertPreferencesSchema = new Schema<IAlertPreferences, AlertPreferencesModel>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    youtube: { type: youtubeAlertsSchema, default: () => ({}) },
    instagram: { type: instagramAlertsSchema, default: () => ({}) },
    facebook: { type: facebookAlertsSchema, default: () => ({}) },
    system: { type: systemAlertsSchema, default: () => ({}) },
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

export const AlertPreferences = mongoose.model<IAlertPreferences, AlertPreferencesModel>(
  "AlertPreferences",
  alertPreferencesSchema,
);
