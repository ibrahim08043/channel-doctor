import { Router } from "express";
import { search, getChannel, getAnalysis, getVideoBreakdown, getCompetitors, getContentPlan, getForecast } from "../controllers/channels.controller";

const router = Router();
router.get("/channels/search", search);
router.get("/channels/:channelId", getChannel);
router.get("/channels/:channelId/analysis", getAnalysis);
router.get("/channels/:channelId/video-breakdown", getVideoBreakdown);
router.get("/channels/:channelId/competitors", getCompetitors);
router.get("/channels/:channelId/content-plan", getContentPlan);
router.get("/channels/:channelId/forecast", getForecast);
export default router;
