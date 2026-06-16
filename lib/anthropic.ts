// Lightweight Anthropic API wrapper for blog drafting + social captions.
// Uses the Messages API; defaults to claude-sonnet-4-6 for cost/quality.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export async function complete(prompt: string, system?: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// For image captioning (Session 12). Accepts a public image URL.
export async function captionImage(imageUrl: string, brandVoice: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const system = `You write social captions in Nautical Nomads' brand voice.\n\n${brandVoice}\n\nWrite ONE caption only — short, minimal, lowercase-friendly, no exclamation marks, emoji allowed sparingly. No hashtags.`;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: imageUrl } },
              { type: "text", text: "Caption this photo." },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.content?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// Generate concise, SEO/accessibility-friendly alt text for an image.
// Returns null when no key is configured or the call fails.
export async function generateAltText(imageUrl: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        system:
          "You write image alt text for an e-commerce site. Describe what is visibly in the photo in one plain, specific sentence under 125 characters. No 'image of'/'photo of' prefixes, no quotes, no marketing fluff.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: imageUrl } },
              { type: "text", text: "Write the alt text." },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.content?.[0]?.text?.trim();
    return t ? t.slice(0, 140) : null;
  } catch {
    return null;
  }
}
