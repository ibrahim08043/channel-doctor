import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { checkConfig, inspectOauth, startOauth, handleCallback } from "../controllers/youtube-oauth.controller";

const router = Router();
router.get("/youtube-oauth/check", checkConfig);
router.get("/youtube-oauth/inspect", requireAuth, inspectOauth);
router.get("/youtube-oauth/start", requireAuth, startOauth);
router.get("/youtube-oauth/callback", handleCallback);
export default router;
