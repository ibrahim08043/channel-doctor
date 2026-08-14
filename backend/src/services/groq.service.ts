import Groq from "groq-sdk";
import { logger } from "../lib/logger";

/**
 * ── Single AI service layer ──────────────────────────────────────────────────
 * Every module in the backend talks to the LLM through this file. Switching
 * providers, models, or tuning retry/fallback behaviour happens in exactly one
 * place.
 *
 * Provider: Groq (https://console.groq.com)
 * Credential: GROQ_API_KEY  (backend/.env)
 *
 * Models (all production/preview tier, chosen for the feature):
 *   DEFAULT_MODEL – strong general text + JSON mode
 *   VISION_MODEL  – the only Groq model with image (vision) input support
 */

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const VISION_MODEL = "qwen/qwen3.6-27b";
// Fast, high-rate-limit model for the social analyzer's multi-call analysis.
// The 70b models are rate-limited hard on Groq's free tier (~30 RPM), which
// caused HTTP 429 when the analyzer made 5-6 sequential calls. llama-3.1-8b
// handles JSON mode and offers a much higher free-tier request ceiling.
export const FAST_MODEL = "llama-3.1-8b-instant";

let _client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY must be set. Add it to backend/.env. " +
          "Generate a key at https://console.groq.com/keys",
      );
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

/** Reset the cached client (useful for tests). */
export function resetGroqClient(): void {
  _client = null;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function logError(provider: "json" | "vision" | "chat", err: unknown): void {
  const e = err as { status?: number; message?: string; name?: string };
  const status = e?.status;
  const message = e?.message ?? String(err);

  // 401 → bad key, 429 → rate limited, 400 → bad request (incl. unsupported model).
  if (status === 401 || status === 403) {
    logger.error({ provider, status }, "Groq auth failed — check GROQ_API_KEY");
  } else if (status === 429) {
    logger.warn({ provider, status }, "Groq rate limited — consider raising your Groq plan limit");
  } else {
    logger.error({ provider, status, message }, "Groq request failed");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a Groq call on transient failures (429 rate-limit, 5xx, network).
 *  Exponential backoff + jitter lets bursts self-throttle on the free tier. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseMs = 1600 }: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number };
      const retriable =
        e.status === 429 || (e.status != null && e.status >= 500) || e.status === undefined;
      if (!retriable || attempt === retries) break;
      const backoff = baseMs * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      logger.warn({ status: e.status, attempt: attempt + 1, backoff }, "Groq retrying after failure");
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/**
 * Best-effort JSON extraction from an LLM response. Groq's JSON mode normally
 * returns clean JSON, but we defensively strip markdown fences and find the
 * first `{...}` block so a slightly-off response never 500s the endpoint.
 */
function extractJson<T>(content: string): T {
  let text = (content ?? "").trim();
  // Strip ```json ... ``` fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // Fall back to first balanced {...} span.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new Error(
      `AI returned malformed JSON (${text.length} chars). ` +
        `Raw preview: ${text.slice(0, 200)}`,
      { cause },
    );
  }
}

/**
 * Text-in / JSON-out completion.
 * - Uses Groq JSON mode (`response_format: json_object`) when the target model
 *   supports it, and automatically falls back to plain completion + extraction
 *   if the model rejects the option.
 */
export async function jsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  opts: CompletionOptions = {},
): Promise<T> {
  const model = opts.model ?? DEFAULT_MODEL;
  const client = getGroqClient();
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    return await withRetry(async () => {
      const res = await client.chat.completions.create({
        model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
        response_format: { type: "json_object" },
        messages,
      });
      const content = res.choices[0]?.message?.content || "{}";
      return extractJson<T>(content);
    });
  } catch (err) {
    logError("json", err);
    // Retry once without JSON mode — some accounts/models reject it.
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
        messages,
      });
      const content = res.choices[0]?.message?.content || "{}";
      return extractJson<T>(content);
    } catch (err2) {
      throw new Error(`AI JSON completion failed (${model}): ${(err2 as Error).message}`);
    }
  }
}

/**
 * Image-in / JSON-out completion (vision). Images are passed as public URLs
 * (or base64 data URIs) via the `image_url` content parts.
 */
export async function visionJsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  imageUrls: string[],
  opts: CompletionOptions = {},
): Promise<T> {
  const model = opts.model ?? VISION_MODEL;
  const client = getGroqClient();
  const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userPrompt },
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: contentParts },
  ];

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 4096,
      messages,
    });
    const content = res.choices[0]?.message?.content || "{}";
    return extractJson<T>(content);
  } catch (err) {
    logError("vision", err);
    const e = err as { status?: number; message?: string };
    const hint =
      e.status === 413
        ? "The vision model's per-minute token limit was exceeded (large images use many tokens). Try smaller/compressed images, or upgrade your Groq plan."
        : "";
    throw new Error(`AI vision analysis failed (${model}): ${(err as Error).message}${hint ? ` — ${hint}` : ""}`);
  }
}

/**
 * Fallback for callers that must send several images but hit the vision
 * model's token cap: analyze each image in its own single-image call and
 * return the list of per-image results. Used by the thumbnail A/B flow where
 * two images in one request always exceed the free-tier 8000 TPM budget.
 */
export async function visionJsonPerImage<T>(
  systemPrompt: string,
  userPrompt: string,
  imageUrls: string[],
  opts: CompletionOptions = {},
): Promise<Array<T | null>> {
  return Promise.all(
    imageUrls.map(async (url) => {
      try {
        return await visionJsonCompletion<T>(systemPrompt, userPrompt, [url], opts);
      } catch (err) {
        logError("vision", err);
        return null;
      }
    }),
  );
}

/**
 * Structured JSON completion.
 *
 * Groq's strict `json_schema` mode is brittle for large nested schemas — the
 * provider rejects its own output with "Generated JSON does not match the
 * expected schema" (HTTP 400) whenever the model omits a nested field. Instead
 * we use Groq's reliable JSON-object mode (`response_format: json_object`,
 * supported by every model) plus a strict extraction + default-fill layer.
 * The `schema` argument is passed to the model as a description so it emits
 * the right shape, but we never depend on provider-side validation.
 */
export async function structuredCompletion<T>(
  schemaName: string,
  schema: Record<string, unknown>,
  systemPrompt: string,
  userPrompt: string,
  opts: CompletionOptions = {},
): Promise<T> {
  const model = opts.model ?? DEFAULT_MODEL;
  const client = getGroqClient();
  const schemaHint = `\n\nREQUIRED OUTPUT SHAPE (JSON keys, types, and required fields):\n${JSON.stringify(schema)}\nFollow it exactly. Every required field MUST be present.`;
  try {
    return await withRetry(async () => {
      const res = await client.chat.completions.create({
        model,
        temperature: opts.temperature ?? 0.5,
        // llama-3.3-70b supports up to 8k output tokens; keep budget below the
        // model's max so large nested responses aren't truncated.
        max_tokens: opts.maxTokens ?? 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system" as const, content: systemPrompt + schemaHint },
          { role: "user" as const, content: userPrompt },
        ],
      });
      const content = res.choices[0]?.message?.content || "{}";
      return extractJson<T>(content);
    });
  } catch (err) {
    logError("json", err);
    try {
      return await jsonCompletion<T>(systemPrompt + schemaHint, userPrompt, opts);
    } catch (err2) {
      throw new Error(`AI structured completion failed (${model}): ${(err2 as Error).message}`);
    }
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Plain conversational completion (no JSON guarantee). */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: CompletionOptions = {},
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  try {
    const res = await getGroqClient().chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    logError("chat", err);
    throw new Error(`AI chat failed (${model}): ${(err as Error).message}`);
  }
}
