import { Router } from "express";
import healthRouter from "./health.routes";
import channelsRouter from "./channels.routes";
import aiRouter from "./ai.routes";
import connectedRouter from "./connected.routes";
import reportsRouter from "./reports.routes";
import youtubeOauthRouter from "./youtube-oauth.routes";
import settingsRouter from "./settings.routes";
import notificationsRouter from "./notifications.routes";

const router = Router();
router.use(healthRouter);
router.use(channelsRouter);
router.use(aiRouter);
router.use(connectedRouter);
router.use(reportsRouter);
router.use(youtubeOauthRouter);
router.use(settingsRouter);
router.use(notificationsRouter);

export default router;
