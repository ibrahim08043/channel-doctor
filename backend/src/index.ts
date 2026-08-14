import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { connectDatabase } from "@workspace/db";
import { createSocketServer } from "./services/socket.service";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed — exiting");
    process.exit(1);
  }

  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // ── Credential check on startup ──────────────────────────────────────────
    const creds = {
      MONGODB_URI: !!process.env.MONGODB_URI,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
      CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
      // Groq key — required for all AI features. Set in backend/.env.
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    };
    const missing = Object.entries(creds).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length === 0) {
      logger.info(creds, "All credentials present");
    } else {
      logger.warn({ missing }, "MISSING credentials — some features will not work");
    }
  });

  // ── Real-time layer ────────────────────────────────────────────────────────
  try {
    await createSocketServer(server);
    logger.info({}, "Socket.IO attached to HTTP server");
  } catch (err) {
    logger.warn({ err }, "Socket.IO failed to initialize — notifications fall back to REST polling");
  }
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
