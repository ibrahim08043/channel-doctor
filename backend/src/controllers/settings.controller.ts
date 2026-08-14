import type { Request, Response, NextFunction } from "express";
import { getUserId, ensureUser } from "../middleware/auth";
import { getSettings, updateSettings } from "../services/settings.service";

/** GET /api/settings — full merged settings for the signed-in user. */
export async function getSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const settings = await getSettings(userId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/settings — partial update, returns the full merged settings. */
export async function updateSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    await ensureUser(userId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<typeof updateSettings>[1] = {
      ai: asRecord(body.ai),
      alerts: asRecord(body.alerts),
      notifications: asRecord(body.notifications),
      profile: asRecord(body.profile),
    };
    const settings = await updateSettings(userId, patch);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
