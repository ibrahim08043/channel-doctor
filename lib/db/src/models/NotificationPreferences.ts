import mongoose, { Schema, type Model } from "mongoose";

export interface INotificationChannels {
  inApp: boolean;
  email: boolean;
  browser: boolean;
  realtime: boolean;
}

export interface INotificationPreferences {
  userId: string;
  channels: INotificationChannels;
  updatedAt: Date;
}

type NotificationPreferencesModel = Model<INotificationPreferences>;

const notificationChannelsSchema = new Schema<INotificationChannels>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    browser: { type: Boolean, default: true },
    realtime: { type: Boolean, default: true },
  },
  { _id: false },
);

const notificationPreferencesSchema = new Schema<INotificationPreferences, NotificationPreferencesModel>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    channels: { type: notificationChannelsSchema, default: () => ({}) },
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

export const NotificationPreferences = mongoose.model<INotificationPreferences, NotificationPreferencesModel>(
  "NotificationPreferences",
  notificationPreferencesSchema,
);
