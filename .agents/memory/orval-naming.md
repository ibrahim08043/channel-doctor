---
name: Orval naming collisions
description: How to avoid TS2308 duplicate export errors from Orval codegen in this workspace.
---

When an OpenAPI request body schema contains nested objects or arrays, Orval generates **both** a TypeScript type (in `types/index.ts`) and a Zod schema (in `api.ts`) under the same name, causing `TS2308: Module has already exported a member`.

**Rule:** Never name a request body schema the same string Orval would auto-derive from the operationId. Orval derives the body schema name as `<OperationId>Body` (PascalCase operationId + "Body"). Use a different suffix.

**Examples that caused collisions:**
- `operationId: generateReport` → avoid `GenerateReportBody` → use `ReportGenRequest`
- `operationId: aiChat` → avoid `AiChatBody` → use `AiChatRequest`

**How to apply:** Any time you add a new POST endpoint with a complex request body schema (nested objects/arrays), give the `$ref` schema a name that does NOT match `<PascalCaseOperationId>Body`.
