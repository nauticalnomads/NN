import { complete } from "@/lib/anthropic";

// Reusable SEO copy generator (collections, products, …). Produces an optimised
// meta title + description. Uses Anthropic when ANTHROPIC_API_KEY is set; falls
// back to a sensible template so it always returns something useful.
// Note: the site layout appends "· Nautical Nomads", so titles omit the brand.

const SYSTEM = `You are an expert e-commerce SEO copywriter for "Nautical Nomads", a premium coastal & nautical lifestyle apparel and accessories brand (understated, beach-to-bar style, quality fabrics). Write metadata that maximises organic ranking and click-through.
Rules:
- seo_title: 50-60 characters. Front-load the primary keyword; specific and compelling. DO NOT include the brand name (it is appended automatically). No quotes/emojis.
- seo_description: 140-160 characters. Natural, benefit-led, include the primary keyword + a secondary keyword, end with a soft call to action. No quotes/emojis.
Return ONLY JSON: {"seo_title":"...","seo_description":"..."}`;

export type Seo = { seo_title: string; seo_description: string };

export async function generateSeo(input: {
  label: string;
  kind: "product category page" | "product";
  context?: string;
}): Promise<Seo> {
  const prompt = `Write SEO metadata for this ${input.kind}: "${input.label}".${
    input.context ? ` Context: ${input.context}.` : ""
  }`;
  const raw = await complete(prompt, SYSTEM);
  if (raw) {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const o = JSON.parse(m[0]);
        if (o.seo_title && o.seo_description) {
          return {
            seo_title: String(o.seo_title).slice(0, 70),
            seo_description: String(o.seo_description).slice(0, 180),
          };
        }
      }
    } catch {
      /* fall through to template */
    }
  }
  // Template fallback (no key / model unavailable).
  return {
    seo_title: input.label.slice(0, 60),
    seo_description:
      `${input.label} — premium coastal apparel from Nautical Nomads. Quality fabrics, understated nautical style. Shop the collection today.`.slice(
        0,
        180,
      ),
  };
}
