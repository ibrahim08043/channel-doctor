import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getProfile, debugOauth, autoDetectYoutube, listSavedAnalyses, createSavedAnalysis,
  lookupChannel, linkChannel, disconnectChannel, getAlerts,
  deleteSavedAnalysis, getStats,
} from "../controllers/connected.controller";

const router = Router();
// Scope auth to the /connected path. A bare `router.use(requireAuth)` leaks to
// every route mounted after this router (Express mounts sub-routers at `/`).
router.use("/connected", requireAuth);

router.get("/connected/me", getProfile);
router.get("/connected/debug-oauth", debugOauth);
router.post("/connected/auto-detect-youtube", autoDetectYoutube);
router.get("/connected/saved-analyses", listSavedAnalyses);
router.post("/connected/saved-analyses", createSavedAnalysis);
router.post("/connected/lookup-channel", lookupChannel);
router.post("/connected/link-channel", linkChannel);
router.delete("/connected/connect", disconnectChannel);
router.get("/connected/alerts", getAlerts);
router.delete("/connected/saved-analyses/:id", deleteSavedAnalysis);
router.get("/connected/stats", getStats);

export default router;
