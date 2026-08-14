import type { Request, Response, NextFunction } from "express";
import { getUserId, ensureUser } from "../middleware/auth";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from "../services/notification.service";

/** GET /api/notifications */
export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const result = await listNotifications(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** GET /api/notifications/unread-count */
export async function unreadCountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/:id/read */
export async function markReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const row = await markNotificationRead(userId, String(req.params.id ?? ""));
    if (!row) {
      res.status(404).json({ error: "notification_not_found" });
      return;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/read-all */
export async function markAllReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const updated = await markAllNotificationsRead(userId);
    res.json({ ok: true, updated });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/notifications/:id */
export async function deleteNotificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const deleted = await deleteNotification(userId, String(req.params.id ?? ""));
    if (!deleted) {
      res.status(404).json({ error: "notification_not_found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/send-test — fires a real-time notification so the
 *  socket wiring can be verified end-to-end from the UI. */
export async function sendTestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    await createNotification(userId, {
      type: "test",
      title: "Real-time notification working",
      body: "This is a test notification pushed over the WebSocket in real time.",
      severity: "info",
      data: { test: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
