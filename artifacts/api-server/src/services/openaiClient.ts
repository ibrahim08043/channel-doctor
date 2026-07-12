import { openai } from "@workspace/integrations-openai-ai-server";

export { openai };

const DEFAULT_MODEL = "gpt-4o-mini";
const VISION_MODEL = "gpt-4o";

export async function jsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  opts: { model?: string; temperature?: number } = {}
): Promise<T> {
  const res = await openai.chat.completions.create({
    model: opts.model || DEFAULT_MODEL,
    temperature: opts.temperature ?? 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const content = res.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI returned malformed JSON");
  }
}

export async function visionJsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  imageUrls: string[],
  opts: { temperature?: number } = {}
): Promise<T> {
  const res = await openai.chat.completions.create({
    model: VISION_MODEL,
    temperature: opts.temperature ?? 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...imageUrls.map(
            (url) =>
              ({ type: "image_url", image_url: { url } }) as const
          ),
        ],
      },
    ],
  });
  const content = res.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI returned malformed JSON");
  }
}
