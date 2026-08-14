import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { logger } from "../lib/logger";

// ── Socket.IO singleton ─────────────────────────────────────────────────────

let io: Server | null = null;

/**
 * Attach a Socket.IO server to the running HTTP server. Call once at startup
 * (backend/src/index.ts) after `app.listen`.
 *
 * Authentication: the client passes `{ auth: { token } }` where `token` is the
 * Clerk session JWT. We verify it via Clerk's backend SDK and join the socket
 * to the user's private room (`user:<userId>`), which is how notifications are
 * routed back to the right browser.
 */
export async function createSocketServer(httpServer: HttpServer): Promise<Server> {
  if (io) return io;

  // `verifyToken` is a standalone export of @clerk/backend (re-exported through
  // @clerk/express). It verifies a Clerk session JWT and returns its claims.
  const { verifyToken } = await import("@clerk/express");

  const server = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
    serveClient: false,
    // Healthy defaults: backoff + infinite reconnect handled client-side too.
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  server.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== "string" || !token) {
        return next(new Error("unauthorized"));
      }
      if (!process.env.CLERK_SECRET_KEY) {
        return next(new Error("auth_unavailable"));
      }
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      const sub = (payload as { sub?: unknown }).sub;
      if (typeof sub !== "string" || !sub) {
        return next(new Error("unauthorized"));
      }
      socket.data.userId = sub;
      next();
    } catch (err) {
      logger.warn({ err }, "[socket] handshake auth failed");
      next(new Error("unauthorized"));
    }
  });

  server.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));
    logger.info({ userId: userId.slice(0, 8), socketId: socket.id }, "[socket] connected");

    // Optional explicit room membership (e.g. channel-level broadcasts).
    socket.on("subscribe", (room: unknown) => {
      if (typeof room === "string") socket.join(room);
    });
    socket.on("unsubscribe", (room: unknown) => {
      if (typeof room === "string") socket.leave(room);
    });

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "[socket] disconnected");
    });
  });

  io = server;
  return server;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function isSocketReady(): boolean {
  return io !== null;
}

/** Emit an event to a single user's private room. No-op before init or if the
 *  socket layer is unavailable — REST still delivers via the notification API. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}

/** Emit an event to every connected client. */
export function emitToAll(event: string, payload: unknown): void {
  io?.emit(event, payload);
}
