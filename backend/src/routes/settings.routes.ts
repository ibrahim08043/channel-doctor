import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settings.controller";

const router = Router();
router.use("/settings", requireAuth);

router.get("/settings", getSettingsHandler);
router.put("/settings", updateSettingsHandler);

export default router;
