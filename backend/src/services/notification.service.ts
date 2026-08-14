import {
  UserNotification,
  NotificationPreferences,
  type NotificationSeverity,
  type NotificationType,
} from "@workspace/db";
import { emitToUser } from "./socket.service";

export interface NewNotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  severity?: NotificationSeverity;
  data?: Record<string, unknown>;
  /** Skip persisting (emit over the wire only). Used for transient events. */
  transient?: boolean;
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Persist a notification and push it to the user's live socket room.
 *
 * Channel gating:
 *  - `realtime` pref off → still persist, but don't emit (in-app + email
 *    remain available through the inbox).
 *  - `inApp` pref off   → don't persist (it never shows in the inbox).
 * This makes the notification-channel toggles on the Alerts tab actually
 * affect behavior instead of being cosmetic.
 */
export async function createNotification(
  userId: string,
  input: NewNotificationInput,
): Promise<void> {
  const prefs = await NotificationPreferences.findOne({ userId }).lean();
  const channels = prefs?.channels ?? { inApp: true, email: false, browser: true, realtime: true };

  const notify = channels.realtime !== false;
  const persist = channels.inApp !== false && !input.transient;

  if (persist) {
    await UserNotification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      severity: input.severity ?? "info",
      read: false,
      data: input.data ?? {},
    });
  }

  if (notify) {
    emitToUser(userId, "notification", {
      id: "live-" + Date.now(),
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      severity: input.severity ?? "info",
      read: false,
      createdAt: new Date().toISOString(),
      data: input.data ?? {},
    });
  }
}

// ── Query ───────────────────────────────────────────────────────────────────

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  message?: string;
  severity: NotificationSeverity;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

function toView(n: UserNotificationDocument): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body ?? "",
    message: n.body ?? "", // alias to match the `message` field shape
    severity: n.severity,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    data: n.data,
  };
}

/** The hydrated document type (includes the `id` virtual + Date timestamps). */
type UserNotificationDocument = InstanceType<typeof UserNotification>;

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<{ items: NotificationView[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    UserNotification.find({ userId }).sort({ createdAt: -1 }).limit(limit),
    UserNotification.countDocuments({ userId, read: false }),
  ]);
  return { items: rows.map((r) => toView(r as unknown as UserNotificationDocument)), unread };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return UserNotification.countDocuments({ userId, read: false });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<NotificationView | null> {
  const row = await UserNotification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true },
  );
  if (!row) return null;
  return toView(row as unknown as UserNotificationDocument);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const res = await UserNotification.updateMany({ userId, read: false }, { $set: { read: true } });
  return res.modifiedCount;
}

export async function deleteNotification(userId: string, notificationId: string): Promise<boolean> {
  const res = await UserNotification.deleteOne({ _id: notificationId, userId });
  return res.deletedCount > 0;
}

/**
 * Check whether a notification of `type` was created recently (within
 * `withinMs`). Used by the alert scanner to avoid duplicate spam.
 */
export async function hasRecentNotification(userId: string, type: NotificationType, withinMs = 6 * 60 * 60 * 1000): Promise<boolean> {
  const recent = await UserNotification.findOne({
    userId,
    type,
    createdAt: { $gte: new Date(Date.now() - withinMs) },
  }).lean();
  return Boolean(recent);
}
