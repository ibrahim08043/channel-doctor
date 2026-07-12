import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 191 }).primaryKey(),
  email: text("email"),
  name: text("name"),
  avatar: text("avatar"),
  channelId: text("channel_id"),
  channelTitle: text("channel_title"),
  channelThumbnail: text("channel_thumbnail"),
  plan: varchar("plan", { length: 16 }).notNull().default("free"),
  youtubeRefreshToken: text("youtube_refresh_token"),
  youtubeTokenExpiry: timestamp("youtube_token_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
