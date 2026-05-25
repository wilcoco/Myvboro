// OpenAI Vision call for tier-4 menu/food match (kickoff §3-4).
// No-ops gracefully when OPENAI_API_KEY isn't set so the verify endpoint
// can still be wired up in environments without the integration.

export type MenuMatchResult = {
  match: boolean;
  confidence: number;
  reason: string;
};

const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";

const PROMPT =
  'First image is a restaurant menu. Second image is food. Is this food plausibly on this menu? Reply strict JSON with shape: {"match": boolean, "confidence": number between 0 and 1, "reason": short string}.';

export async function verifyMenuMatch(
  menuUrl: string,
  foodUrl: string,
): Promise<MenuMatchResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: menuUrl } },
            { type: "image_url", image_url: { url: foodUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  }).catch(() => null);

  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  try {
    const parsed = JSON.parse(content) as Partial<MenuMatchResult>;
    if (
      typeof parsed.match !== "boolean" ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return parsed as MenuMatchResult;
  } catch {
    return null;
  }
}
