---
name: Settings Fast Refresh circular import
description: Exporting utility functions from a page component file breaks Vite Fast Refresh and causes "Cannot access App before initialization" crash.
---

**Rule:** Never export non-component symbols (utility functions, types, constants) from files that also have a default React component export.

**Why:** Vite Fast Refresh requires that a file exports only React components. When `Settings.tsx` exported both `default SettingsPage` and `loadPrefs()`, Vite logged "loadPrefs export is incompatible" and invalidated the module. Because `SocialAnalyzer.tsx` imported `loadPrefs` from `Settings.tsx`, and `App.tsx` imported `Settings.tsx` via the router, a circular HMR invalidation cascade caused "Cannot access 'App' before initialization" at runtime.

**How to apply:** Any utility (function, constant, type) that needs to be shared between pages must live in `src/lib/` (e.g. `src/lib/prefs.ts`). The page file may re-export it for backward compatibility but the primary source must be the lib file. Pattern used: `src/lib/prefs.ts` → imported by both `Settings.tsx` and `SocialAnalyzer.tsx`.
