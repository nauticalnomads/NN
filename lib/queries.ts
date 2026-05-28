import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow, ProductImageRow, CollectionRow } from "@/lib/database.types";

export type ProductWithRelations = ProductRow & {
  variants: VariantRow[];
  product_images: ProductImageRow[];
};

// All storefront reads go through the anon client + RLS, which already limits
// rows to `published`. Every helper degrades to an empty/null result if Supabase
// is unconfigured or a query fails, so pages always render (empty catalogue is a
// valid state until the Session 03 migration runs).
function configured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function getProducts(
  opts: {
    limit?: number;
    offset?: number;
    sort?: "newest" | "price_asc" | "price_desc" | "featured";
  } = {},
): Promise<{ products: ProductWithRelations[]; count: number }> {
  if (!configured()) return { products: [], count: 0 };
  const { limit = 24, offset = 0, sort = "featured" } = opts;
  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select("*, variants(*), product_images(*)", { count: "exact" })
      .eq("status", "published");

    if (sort === "price_asc") query = query.order("price", { ascending: true });
    else if (sort === "price_desc") query = query.order("price", { ascending: false });
    else if (sort === "newest") query = query.order("published_at", { ascending: false });
    else query = query.order("featured", { ascending: false }).order("sort_order");

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return { products: (data ?? []) as unknown as ProductWithRelations[], count: count ?? 0 };
  } catch {
    return { products: [], count: 0 };
  }
}

export async function getFeaturedProducts(limit = 6): Promise<ProductWithRelations[]> {
  if (!configured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, variants(*), product_images(*)")
      .eq("status", "published")
      .eq("featured", true)
      .order("sort_order")
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as ProductWithRelations[];
  } catch {
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  if (!configured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, variants(*), product_images(*)")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ProductWithRelations) ?? null;
  } catch {
    return null;
  }
}

export async function getProductSlugs(): Promise<string[]> {
  if (!configured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("slug")
      .eq("status", "published");
    if (error) throw error;
    return ((data ?? []) as unknown as { slug: string }[]).map((p) => p.slug);
  } catch {
    return [];
  }
}

export async function getCollections(): Promise<CollectionRow[]> {
  if (!configured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("status", "published")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as CollectionRow[];
  } catch {
    return [];
  }
}

export async function getCollectionBySlug(
  slug: string,
): Promise<{ collection: CollectionRow; products: ProductWithRelations[] } | null> {
  if (!configured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    const collection = data as unknown as CollectionRow | null;
    if (!collection) return null;

    const { data: rows } = await supabase
      .from("collection_products")
      .select("sort_order, products(*, variants(*), product_images(*))")
      .eq("collection_id", collection.id)
      .order("sort_order");

    const products = ((rows ?? []) as unknown as { products: ProductWithRelations | null }[])
      .map((r) => r.products)
      .filter((p): p is ProductWithRelations => !!p && p.status === "published");

    return { collection, products };
  } catch {
    return null;
  }
}

// Primary image (or first) for a product, with alt-text fallback to the title.
export function primaryImage(product: ProductWithRelations) {
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const img = images[0];
  return img ? { url: img.url, alt: img.alt || product.title } : null;
}
