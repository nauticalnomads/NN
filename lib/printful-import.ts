import { createServiceClient } from "@/lib/supabase/service";
import { getSyncProduct } from "@/lib/printful";

type SB = ReturnType<typeof createServiceClient>;

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 70) || "product"
  );
}

export type ImportResult = "created" | "exists" | "empty" | "error";

// Create a draft product from a single Printful sync product, mapped for
// fulfilment (provider ids, variants, primary image, price). Idempotent: returns
// "exists" without changes if already mapped. Shared by the manual import action
// and the Printful webhook (auto-draft on publish).
export async function importPrintfulProduct(
  sb: SB,
  syncId: string | number,
  storeId?: string,
  opts: { checkExists?: boolean } = {},
): Promise<ImportResult> {
  const id = String(syncId);
  if (opts.checkExists !== false) {
    const { data: ex } = await sb
      .from("products")
      .select("id")
      .eq("provider", "printful")
      .eq("provider_product_id", id)
      .maybeSingle();
    if (ex) return "exists";
  }

  let sp: { id: number; name: string; thumbnail_url?: string };
  let svs: Awaited<ReturnType<typeof getSyncProduct>>["sync_variants"];
  try {
    const detail = await getSyncProduct(id, storeId);
    sp = detail.sync_product;
    svs = detail.sync_variants ?? [];
  } catch {
    return "error";
  }
  if (!sp || svs.length === 0) return "empty";

  const prices = svs.map((v) => Number(v.retail_price)).filter((n) => Number.isFinite(n) && n > 0);
  const price = prices.length ? Math.min(...prices) : 0;
  const currency = svs[0].currency || "GBP";
  const image =
    sp.thumbnail_url ||
    svs.find((v) => v.product?.image)?.product?.image ||
    svs.flatMap((v) => v.files ?? []).find((f) => f.preview_url)?.preview_url ||
    null;

  const { data: prod, error } = await sb
    .from("products")
    .insert({
      title: sp.name,
      slug: `${slugify(sp.name)}-${id.slice(-5)}`,
      status: "draft",
      price,
      currency,
      provider: "printful",
      provider_product_id: id,
      source: "printful",
      source_id: id,
    } as never)
    .select("id")
    .single();
  if (error || !prod) return "error";

  const pid = (prod as unknown as { id: string }).id;
  const vrows = svs.map((v, i) => ({
    product_id: pid,
    title:
      (v.name || "")
        .replace(sp.name, "")
        .replace(/^[\s\-/|]+/, "")
        .trim() ||
      v.name ||
      `Variant ${i + 1}`,
    sku: v.sku || null,
    provider_variant_id: String(v.id),
    price: Number(v.retail_price) || price,
    sort_order: i,
  }));
  await sb.from("variants").insert(vrows as never);
  if (image) {
    await sb.from("product_images").insert({
      product_id: pid,
      url: image,
      alt: sp.name,
      sort_order: 0,
      is_primary: true,
    } as never);
  }
  return "created";
}
