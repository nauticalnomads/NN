import { createPublicClient } from "@/lib/supabase/public";
import type { CollectionRow } from "@/lib/database.types";
import { primaryImage, type ProductWithRelations } from "@/lib/product";

export { primaryImage };
export type { ProductWithRelations };

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
    const supabase = createPublicClient();
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
    const supabase = createPublicClient();
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
    const supabase = createPublicClient();
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
    const supabase = createPublicClient();
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

export async function getPublishedPostSlugs(): Promise<string[]> {
  if (!configured()) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("blog_posts")
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
    const supabase = createPublicClient();
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
    const supabase = createPublicClient();
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

// Fetch published products by id (for the wishlist page, §10). Preserves no
// particular order; the client orders by its own list.
export async function getProductsByIds(ids: string[]): Promise<ProductWithRelations[]> {
  if (!configured() || ids.length === 0) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, variants(*), product_images(*)")
      .in("id", ids)
      .eq("status", "published");
    if (error) throw error;
    return (data ?? []) as unknown as ProductWithRelations[];
  } catch {
    return [];
  }
}

// "You may also like" on the PDP. Prefers other products that share a collection
// with the current one, then tops up with featured/other published products so
// the rail is always full. Excludes the product itself and de-dupes.
export async function getRelatedProducts(
  productId: string,
  limit = 4,
): Promise<ProductWithRelations[]> {
  if (!configured()) return [];
  try {
    const supabase = createPublicClient();
    const picks = new Map<string, ProductWithRelations>();

    // Same-collection siblings first.
    const { data: memberships } = await supabase
      .from("collection_products")
      .select("collection_id")
      .eq("product_id", productId);
    const collectionIds = ((memberships ?? []) as unknown as { collection_id: string }[]).map(
      (m) => m.collection_id,
    );

    if (collectionIds.length) {
      const { data: siblings } = await supabase
        .from("collection_products")
        .select("products(*, variants(*), product_images(*))")
        .in("collection_id", collectionIds)
        .limit(limit * 4);
      for (const row of (siblings ?? []) as unknown as {
        products: ProductWithRelations | null;
      }[]) {
        const p = row.products;
        if (p && p.id !== productId && p.status === "published" && !picks.has(p.id))
          picks.set(p.id, p);
      }
    }

    // Top up with other published products if we're short.
    if (picks.size < limit) {
      const { data: more } = await supabase
        .from("products")
        .select("*, variants(*), product_images(*)")
        .eq("status", "published")
        .neq("id", productId)
        .order("featured", { ascending: false })
        .order("sort_order")
        .limit(limit * 3);
      for (const p of (more ?? []) as unknown as ProductWithRelations[]) {
        if (!picks.has(p.id)) picks.set(p.id, p);
        if (picks.size >= limit) break;
      }
    }

    return Array.from(picks.values()).slice(0, limit);
  } catch {
    return [];
  }
}

// Published sub-collections of a parent slug (for PLP sub-nav tabs, §5.2).
export async function getChildCollections(
  parentSlug: string,
): Promise<{ slug: string; title: string }[]> {
  if (!configured()) return [];
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("collections")
      .select("slug, title")
      .eq("parent_slug", parentSlug)
      .eq("status", "published")
      .order("sort_order");
    return (data as unknown as { slug: string; title: string }[]) ?? [];
  } catch {
    return [];
  }
}

// (primaryImage moved to lib/product.ts so client components can use it
// without dragging server-only code into their bundle.)
