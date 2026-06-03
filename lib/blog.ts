// Blog auto-queue (§B-13). Drafts are created on:
//   - new product published (vs. existing draft → published transition)
//   - product on-sale (compare_at_price > price after update)
// Manual URL paste is handled by /admin/blog → drafts.
// De-dups by (product_id, trigger, status='draft' or 'scheduled').
import { createServiceClient } from "@/lib/supabase/service";
import { complete } from "@/lib/anthropic";

export async function autoQueueForProduct(
  productId: string,
  trigger: "auto_new_product" | "auto_on_sale",
) {
  const sb = createServiceClient();
  // De-dup
  const { data: existing } = await sb
    .from("blog_posts")
    .select("id")
    .eq("product_id", productId)
    .eq("trigger", trigger)
    .in("status", ["draft", "scheduled"])
    .maybeSingle();
  if (existing) return { skipped: "duplicate" };

  const { data: prodData } = await sb
    .from("products")
    .select("title, slug, description, currency, price, compare_at_price")
    .eq("id", productId)
    .maybeSingle();
  const p = prodData as unknown as {
    title: string;
    slug: string;
    description: string | null;
    currency: string;
    price: number;
    compare_at_price: number | null;
  } | null;
  if (!p) return { error: "product not found" };

  const { data: settingsData } = await sb
    .from("store_settings")
    .select("brand_voice")
    .eq("id", true)
    .maybeSingle();
  const voice = (settingsData as unknown as { brand_voice: string } | null)?.brand_voice || "";

  const intent =
    trigger === "auto_on_sale"
      ? `Write a short blog post (250-400 words) telling readers the product "${p.title}" is on sale (was £${p.compare_at_price}, now £${p.price}). Don't be salesy. Open with a small specific image.`
      : `Write a short blog post (250-400 words) introducing the new product "${p.title}". Don't be salesy. Open with a small specific image. End with one quiet line.`;

  const prompt = `${intent}\n\nProduct description for reference (Shopify is authoritative):\n${p.description ?? "(none)"}\n\nReturn ONLY a JSON object: { "title": "...", "body": "markdown body", "seo_title": "...", "seo_description": "..." }`;
  const raw = await complete(prompt, `You write in Nautical Nomads' brand voice.\n\n${voice}`);

  let parsed: { title: string; body: string; seo_title: string; seo_description: string } | null =
    null;
  if (raw) {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      /* ignore */
    }
  }

  const fallbackTitle = trigger === "auto_on_sale" ? `${p.title} — on sale` : `${p.title} — new in`;
  const draft = {
    title: parsed?.title ?? fallbackTitle,
    slug: blogSlug(parsed?.title ?? fallbackTitle),
    body: parsed?.body ?? "",
    seo_title: parsed?.seo_title ?? parsed?.title ?? fallbackTitle,
    seo_description: parsed?.seo_description ?? "",
    status: "draft" as const,
    trigger,
    product_id: productId,
  };

  await sb.from("blog_posts").insert(draft as never);
  return { queued: true, title: draft.title };
}

function blogSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// Pull a usable title/description/body out of raw HTML (best-effort, no deps).
function extractPage(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1].trim()) : "";
  };
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pick(
      /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    pick(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i,
    );
  const image =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, description, image, text: decodeEntities(text).slice(0, 8000) };
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Fetch a URL and draft a brand-voice blog post from it. Uses Anthropic when
// ANTHROPIC_API_KEY is configured; otherwise falls back to the page's own
// title + text so a draft always has real content to edit. Returns a status the
// admin UI surfaces.
export async function draftFromUrl(url: string): Promise<{
  ok: boolean;
  id?: string;
  title?: string;
  status: "ai" | "scraped" | "fetch_failed" | "insert_failed";
}> {
  let page = { title: "", description: "", image: "", text: "" };
  let fetched = false;
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        // Many sites 403 a bare server-side fetch without a browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (compatible; NauticalNomadsBot/1.0; +https://nautical-nomads.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (r.ok) {
      page = extractPage(await r.text());
      fetched = !!page.text;
    }
  } catch {
    /* network/DNS failure — fall through to the URL-only draft */
  }

  const sb = createServiceClient();
  const { data: settingsData } = await sb
    .from("store_settings")
    .select("brand_voice")
    .eq("id", true)
    .maybeSingle();
  const voice = (settingsData as unknown as { brand_voice: string } | null)?.brand_voice || "";

  const source = page.text || page.description;
  const prompt = `Source page title: ${page.title || "(unknown)"}\nSource URL: ${url}\n\nSource page content:\n\n${source || "(could not fetch the page content)"}\n\nWrite a 250-400 word blog post in our voice based on this. Return ONLY JSON: { "title": "...", "body": "markdown", "seo_title": "...", "seo_description": "..." }`;
  const raw = await complete(prompt, `You write in Nautical Nomads' brand voice.\n\n${voice}`);

  let parsed: { title: string; body: string; seo_title: string; seo_description: string } | null =
    null;
  if (raw) {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      /* model returned non-JSON — fall back to scraped content */
    }
  }

  // Fallback draft: never empty when we managed to read the page. The editor can
  // polish it; AI just turns this into finished copy when the key is set.
  const fallbackTitle = page.title || "Draft from URL";
  const fallbackBody = page.text
    ? `> Drafted from [the source](${url}). Edit before publishing.\n\n${page.description ? page.description + "\n\n" : ""}${page.text.slice(0, 2000)}`
    : `> Could not reach **${url}** to read its content. Write the post here, or check the link.`;

  const title = parsed?.title ?? fallbackTitle;
  const draft = {
    title,
    slug: blogSlug(title),
    body: parsed?.body ?? fallbackBody,
    excerpt: parsed?.seo_description ?? page.description ?? "",
    seo_title: parsed?.seo_title ?? title,
    seo_description: parsed?.seo_description ?? page.description ?? "",
    cover_image_url: page.image || null,
    status: "draft" as const,
    trigger: "manual_url" as const,
    source_url: url,
  };
  let { data, error } = await sb
    .from("blog_posts")
    .insert(draft as never)
    .select("id")
    .single();
  // Tolerate the cover_image_url column not existing yet (migration pending).
  if (error && /cover_image_url/.test(error.message || "")) {
    const rest = { ...(draft as Record<string, unknown>) };
    delete rest.cover_image_url;
    ({ data, error } = await sb
      .from("blog_posts")
      .insert(rest as never)
      .select("id")
      .single());
  }
  if (error) return { ok: false, status: "insert_failed" };

  const id = (data as unknown as { id: string } | null)?.id;
  const status = parsed ? "ai" : fetched ? "scraped" : "fetch_failed";
  return { ok: true, id, title, status };
}
