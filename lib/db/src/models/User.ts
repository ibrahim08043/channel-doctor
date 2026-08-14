import mongoose, { Schema, type Model } from "mongoose";

export interface IUser {
  _id: string;
  email?: string;
  name?: string;
  avatar?: string;
  channelId?: string;
  channelTitle?: string;
  channelThumbnail?: string;
  plan: string;
  youtubeRefreshToken?: string;
  youtubeTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  id: string;
}

type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    _id: { type: String },
    email: { type: String },
    name: { type: String },
    avatar: { type: String },
    channelId: { type: String },
    channelTitle: { type: String },
    channelThumbnail: { type: String },
    plan: { type: String, default: "free" },
    youtubeRefreshToken: { type: String },
    youtubeTokenExpiry: { type: Date },
  },
  {
    timestamps: true,
    _id: false,
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

// Index for efficient user lookups
userSchema.index({ channelId: 1 });

// Index for fetching users with connected channels
userSchema.index({ youtubeRefreshToken: 1 });

export const User = mongoose.model<IUser, UserModel>("User", userSchema);
