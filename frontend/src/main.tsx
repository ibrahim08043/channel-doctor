import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

document.documentElement.classList.add("dark");

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
