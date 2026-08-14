import mongoose, { Schema, type Model } from "mongoose";

export type ThemeMode = "dark" | "light";

export interface IUserSettings {
  userId: string;
  displayName?: string;
  language: string;
  theme: ThemeMode;
  animations: boolean;
  timezone?: string;
  updatedAt: Date;
}

type UserSettingsModel = Model<IUserSettings>;

const userSettingsSchema = new Schema<IUserSettings, UserSettingsModel>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },
    language: { type: String, default: "en" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    animations: { type: Boolean, default: true },
    timezone: { type: String },
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

export const UserSettings = mongoose.model<IUserSettings, UserSettingsModel>(
  "UserSettings",
  userSettingsSchema,
);
