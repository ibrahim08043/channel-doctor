import mongoose, { Schema, type Model } from "mongoose";

export interface ISavedAnalysis {
  userId: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  healthScore: number;
  diagnosis: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type SavedAnalysisModel = Model<ISavedAnalysis>;

const savedAnalysisSchema = new Schema<ISavedAnalysis, SavedAnalysisModel>(
  {
    userId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    channelTitle: { type: String, required: true },
    channelThumbnail: { type: String, required: true },
    healthScore: { type: Number, required: true },
    diagnosis: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
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

// Compound index for user's saved analyses
savedAnalysisSchema.index({ userId: 1, createdAt: -1 });

export const SavedAnalysis = mongoose.model<ISavedAnalysis, SavedAnalysisModel>(
  "SavedAnalysis",
  savedAnalysisSchema,
);
