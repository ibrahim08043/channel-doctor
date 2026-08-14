import { Router } from "express";
import {
  titleOptimizer, thumbnailAb, retentionMapper, contentIdeas, whyFailed, aiChat,
  hookGenerator, contentOptimizer, seoOptimizer, growthEngine,
} from "../controllers/ai.controller";

const router = Router();
router.post("/ai/title-optimizer", titleOptimizer);
router.post("/ai/thumbnail-ab", thumbnailAb);
router.post("/ai/retention-mapper", retentionMapper);
router.post("/ai/content-ideas", contentIdeas);
router.post("/ai/why-failed", whyFailed);
router.post("/ai/hook-generator", hookGenerator);
router.post("/ai/content-optimizer", contentOptimizer);
router.post("/ai/seo-optimizer", seoOptimizer);
router.post("/ai/growth-engine", growthEngine);
router.post("/ai/chat", aiChat);
export default router;
