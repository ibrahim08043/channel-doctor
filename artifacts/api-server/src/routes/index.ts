import { Router, type IRouter } from "express";
import healthRouter from "./health";
import channelsRouter from "./channels";
import aiRouter from "./ai";
import connectedRouter from "./connected";
import reportsRouter from "./reports";
import youtubeOauthRouter from "./youtube-oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(channelsRouter);
router.use(aiRouter);
router.use(connectedRouter);
router.use(reportsRouter);
router.use(youtubeOauthRouter);

export default router;
