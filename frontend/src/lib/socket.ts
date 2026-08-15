import { io, type Socket } from "socket.io-client";
import { apiOrigin } from "@/lib/api";

/**
 * Socket.IO client singleton for the Social Pulse real-time layer.
 *
 * The server is served from the same origin as the API (the backend), so we
 * reuse the same origin resolution as the REST calls. In production this is
 * the deployed backend origin (or the frontend origin if none is configured)
 * — never a developer's localhost.
 */
let socket: Socket | null = null;

let _tokenGetter: (() => Promise<string | null> | string | null) | null = null;

/** Register the function that supplies the Clerk session JWT on connect. */
export function registerSocketTokenGetter(
  getter: (() => Promise<string | null> | string | null) | null,
): void {
  _tokenGetter = getter;
}

function createSocket(): Socket {
  const url = apiOrigin();
  const s = io(url, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: async (cb) => {
      const token = _tokenGetter ? await _tokenGetter() : null;
      cb({ token: token ?? undefined });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    autoConnect: true,
  });
  return s;
}

/** Lazily create (or return) the shared socket instance. */
export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (!socket) socket = createSocket();
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Join the user's channel room for channel-scoped broadcasts. */
export function subscribeToRoom(room: string): void {
  getSocket()?.emit("subscribe", room);
}

export function unsubscribeFromRoom(room: string): void {
  getSocket()?.emit("unsubscribe", room);
}
