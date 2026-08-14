import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
  deleteNotificationHandler,
  sendTestHandler,
} from "../controllers/notifications.controller";
import { scanForAlertsHandler } from "../controllers/alert-scan.controller";

const router = Router();
router.use("/notifications", requireAuth);

router.get("/notifications", listNotificationsHandler);
router.get("/notifications/unread-count", unreadCountHandler);
router.post("/notifications/read-all", markAllReadHandler);
router.post("/notifications/send-test", sendTestHandler);
router.post("/notifications/scan", scanForAlertsHandler);
router.post("/notifications/:id/read", markReadHandler);
router.post("/notifications/read/:id", markReadHandler); // alias: /api/notifications/read/:id
router.delete("/notifications/:id", deleteNotificationHandler);

// Top-level convenience aliases (mounted at /api):
//   GET  /api/unread-count
router.get("/unread-count", requireAuth, unreadCountHandler);

export default router;
