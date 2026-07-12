import app from "./app";
import { logger } from "./lib/logger";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // ── Credential check on startup ──────────────────────────────────────────
  const creds = {
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
  };
  const missing = Object.entries(creds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length === 0) {
    logger.info(creds, "All credentials present");
  } else {
    logger.warn({ missing }, "MISSING credentials — some features will not work");
  }
});
