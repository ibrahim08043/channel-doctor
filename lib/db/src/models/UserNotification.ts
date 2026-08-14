import mongoose, { Schema, type Model } from "mongoose";

export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationType =
  | "subscriber_change"
  | "subscriber_milestone"
  | "subscriber_drop"
  | "viral_video"
  | "video_performance_drop"
  | "ctr_drop"
  | "retention_drop"
  | "low_impressions"
  | "monetization"
  | "copyright"
  | "consistency"
  | "growth_spike"
  | "follower_spike"
  | "follower_drop"
  | "viral_reel"
  | "engagement_drop"
  | "post_performance"
  | "page_growth"
  | "facebook_engagement"
  | "billing"
  | "ai_quota"
  | "storage"
  | "security"
  | "ai_completed"
  | "analysis_completed"
  | "optimization_completed"
  | "report_generated"
  | "system"
  | "test";

export interface IUserNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: NotificationSeverity;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type UserNotificationModel = Model<IUserNotification>;

const userNotificationSchema = new Schema<IUserNotification, UserNotificationModel>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "info" },
    read: { type: Boolean, default: false, index: true },
    data: { type: Schema.Types.Mixed },
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

// Efficient unread-count + inbox queries per user
userNotificationSchema.index({ userId: 1, read: 1 });
userNotificationSchema.index({ userId: 1, createdAt: -1 });

export const UserNotification = mongoose.model<IUserNotification, UserNotificationModel>(
  "UserNotification",
  userNotificationSchema,
);
