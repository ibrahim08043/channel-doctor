import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import { apiOrigin } from "@/lib/api";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

document.documentElement.classList.add("dark");

// Route all generated API calls (same-origin `/api/*` paths) to the backend
// origin. In dev this is VITE_API_ORIGIN (the local API server); in
// production it is the deployed backend origin (or the Netlify site itself).
setBaseUrl(apiOrigin());

let getTokenFn: (() => Promise<string | null>) | null = null;

setAuthTokenGetter(() => (getTokenFn ? getTokenFn() : null));

export function registerTokenGetter(fn: (() => Promise<string | null>) | null) {
  getTokenFn = fn;
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    appearance={{
      variables: {
        colorPrimary: "#a855f7",
        colorBackground: "#0a0a0f",
        colorText: "#fafafa",
        colorInputBackground: "#1a1a24",
        colorInputText: "#fafafa",
      },
    }}
  >
    <App />
  </ClerkProvider>
);
