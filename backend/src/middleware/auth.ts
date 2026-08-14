import type { Request, Response, NextFunction, RequestHandler } from "express";

export interface AuthedRequest extends Request {
  userId?: string;
}

// ── Lazy Clerk loader ─────────────────────────────────────────────────────
// Clerk checks for publishable keys at module evaluation time.
// We catch that error so the app starts without Clerk configured.

let _clerkModule: { getAuth: Function; clerkMiddleware: Function } | null = null;
let _loadError: string | null = null;

async function loadClerk(): Promise<void> {
  if (_clerkModule || _loadError) return;
  try {
    const mod = await import("@clerk/express");
    _clerkModule = {
      getAuth: mod.getAuth,
      clerkMiddleware: mod.clerkMiddleware(),
    };
  } catch (e: any) {
    _loadError = e?.message || String(e);
    console.warn("[auth] Clerk unavailable:", _loadError);
  }
}

// Start loading Clerk immediately (non-blocking)
loadClerk();

// ── Middleware ─────────────────────────────────────────────────────────────

export const clerkMiddleware: RequestHandler = (req, res, next) => {
  if (_clerkModule) {
    _clerkModule.clerkMiddleware(req, res, next);
    return;
  }
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!_clerkModule) {
    res.status(503).json({ error: `Auth unavailable: ${_loadError ?? "CLERK_SECRET_KEY not set"}` });
    return;
  }
  const auth = _clerkModule.getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = auth.userId;
  next();
};

export async function ensureUser(userId: string, profile?: { email?: string; name?: string; avatar?: string }) {
  const { User } = await import("@workspace/db");
  const existing = await User.findById(userId);
  if (existing) return existing;
  await User.create({ _id: userId, email: profile?.email, name: profile?.name, avatar: profile?.avatar });
  return (await User.findById(userId))!;
}

export function getUserId(req: Request): string {
  return (req as AuthedRequest).userId!;
}
