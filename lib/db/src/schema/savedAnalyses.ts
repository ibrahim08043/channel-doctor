import { pgTable, text, timestamp, real, uuid, varchar, jsonb } from "drizzle-orm/pg-core";

export const savedAnalysesTable = pgTable("saved_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 191 }).notNull(),
  channelId: text("channel_id").notNull(),
  channelTitle: text("channel_title").notNull(),
  channelThumbnail: text("channel_thumbnail").notNull(),
  healthScore: real("health_score").notNull(),
  diagnosis: text("diagnosis").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SavedAnalysis = typeof savedAnalysesTable.$inferSelect;
export type InsertSavedAnalysis = typeof savedAnalysesTable.$inferInsert;
