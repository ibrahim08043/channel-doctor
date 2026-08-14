import { Router } from "express";
import { analyzeSocial, generateSocialReport, generateReport } from "../controllers/reports.controller";

const router = Router();
router.post("/ai/analyze-social", analyzeSocial);
router.post("/reports/generate-social", generateSocialReport);
router.post("/reports/generate", generateReport);
export default router;
