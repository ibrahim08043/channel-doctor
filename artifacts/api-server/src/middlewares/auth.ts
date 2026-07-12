import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth, clerkMiddleware } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export { clerkMiddleware };

export interface AuthedRequest extends Request {
  userId?: string;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = auth.userId;
  next();
};

export async function ensureUser(userId: string, profile?: { email?: string; name?: string; avatar?: string }) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      id: userId,
      email: profile?.email,
      name: profile?.name,
      avatar: profile?.avatar,
    });
    return (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
  }
  return existing[0];
}

export function getUserId(req: Request): string {
  return (req as AuthedRequest).userId!;
}
