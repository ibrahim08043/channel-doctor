/**
 * Resolve the backend origin the browser should talk to.
 *
 * - Development: VITE_API_ORIGIN points at the local API server
 *   (frontend/.env) so the Google OAuth callback URI registered in Google
 *   Cloud Console matches what the server computes.
 * - Production: set VITE_API_ORIGIN on Netlify to the deployed backend
 *   origin (no trailing slash). If it is missing, fall back to the frontend's
 *   own origin — never to a developer machine.
 *
 * The production build additionally refuses to honor a localhost/127.0.0.1
 * value: a deployed browser must never try to reach a developer's machine.
 */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_ORIGIN;
  const trimmed = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  if (
    trimmed &&
    (!import.meta.env.PROD || !/localhost|127\.0\.0\.1/.test(trimmed))
  ) {
    return trimmed;
  }
  return window.location.origin.replace(/\/+$/, "");
}

/** Resolve an API path against the backend origin. */
export function apiUrl(path: string): string {
  return `${apiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
