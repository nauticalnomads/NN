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

// Fetch a URL and use Anthropic to write a brand-voice draft from it.
export async function draftFromUrl(url: string) {
  let body = "";
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (r.ok)
      body = (await r.text())
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<style[\s\S]*?<\/style>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 8000);
  } catch {
    /* skip */
  }

  const sb = createServiceClient();
  const { data: settingsData } = await sb
    .from("store_settings")
    .select("brand_voice")
    .eq("id", true)
    .maybeSingle();
  const voice = (settingsData as unknown as { brand_voice: string } | null)?.brand_voice || "";

  const prompt = `Source page content:\n\n${body || `(could not fetch; the URL is ${url})`}\n\nWrite a 250-400 word blog post in our voice based on this. Return ONLY JSON: { "title": "...", "body": "markdown", "seo_title": "...", "seo_description": "..." }`;
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
  const title = parsed?.title ?? "Draft from URL";
  const draft = {
    title,
    slug: blogSlug(title),
    body: parsed?.body ?? "",
    seo_title: parsed?.seo_title ?? title,
    seo_description: parsed?.seo_description ?? "",
    status: "draft" as const,
    trigger: "manual_url" as const,
    source_url: url,
  };
  const { data } = await sb
    .from("blog_posts")
    .insert(draft as never)
    .select("id")
    .single();
  return { id: (data as unknown as { id: string } | null)?.id, title };
}
