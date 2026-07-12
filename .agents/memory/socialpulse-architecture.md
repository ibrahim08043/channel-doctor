---
name: SocialPulse AI architecture
description: Key decisions and constraints for the SocialPulse AI (Channel Doctor) project.
---

**Artifact dir:** `channel-doctor` — DO NOT rename the directory or workflow breaks. All rebrand ("SocialPulse AI") is display-only in JSX/CSS.

**Framer Motion Variants:** The `transition.type` field must be typed as `"spring" as const` (not `"spring"` as a plain string) to satisfy `AnimationGeneratorType`. Import `Variants` from `framer-motion` and type all variant objects with it.

**Why:** `framer-motion` v12+ has strict TypeScript types for `transition.type`. The `string` type is not assignable to `AnimationGeneratorType`.

**Instagram/Facebook analysis:** AI-only (no real API). Always returns a `disclaimer` field. The route is `POST /api/ai/analyze-social`.

**DOCX report:** Uses the `docx` npm package installed in `@workspace/api-server`. Route is `POST /api/reports/generate`. Returns `{ docxBase64, filename }`.

**Route wiring:** All new routes must be added to `artifacts/api-server/src/routes/index.ts` via `router.use(newRouter)`.
