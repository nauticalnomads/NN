import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Dynamic navigation tree, built from the published collection taxonomy
// (3 levels: gender root → category column → subcategory link). Replaces the
// hand-curated lib/navigation.ts NAV for the header/mega-menu so every published
// category appears automatically. Column images use each collection's cover
// photo (hero_image_url), set on /admin/collections/[id].
//
// Only collections that actually have a published product (directly or via the
// ancestor-chain links) are shown — so every nav link lands on a populated
// collection page rather than an empty one.

export type NavSub = { label: string; slug: string };
export type NavColumn = { heading: string; slug: string; image: string | null; links: NavSub[] };
export type NavRoot = { label: string; slug: string; columns: NavColumn[] };

type Row = {
  id: string;
  slug: string;
  title: string;
  parent_slug: string | null;
  hero_image_url: string | null;
  sort_order: number | null;
};

// Preferred order for the top-level items; anything else falls in after, by sort.
const ROOT_ORDER: Record<string, number> = { men: 0, women: 1, accessories: 2 };

export const getNavTree = unstable_cache(
  async (): Promise<NavRoot[]> => {
    let cols: Row[] = [];
    const populated = new Set<string>();
    // Anon (public-read) client — safe at build time and inside unstable_cache,
    // unlike the service client (whose key is absent during `next build`).
    try {
      const sb = createPublicClient();
      const { data } = await sb
        .from("collections")
        .select("id, slug, title, parent_slug, hero_image_url, sort_order")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      cols = (data as unknown as Row[]) ?? [];

      // Collection ids that have at least one published product linked.
      const { data: cp } = await sb
        .from("collection_products")
        .select("collection_id, products(status)")
        .limit(5000);
      for (const r of (cp as unknown as {
        collection_id: string;
        products: { status: string } | { status: string }[] | null;
      }[]) ?? []) {
        const prod = Array.isArray(r.products) ? r.products[0] : r.products;
        if (prod?.status === "published") populated.add(r.collection_id);
      }
    } catch {
      return [];
    }
    const childrenOf = (slug: string | null) => cols.filter((c) => c.parent_slug === slug);

    const roots = cols
      .filter((c) => !c.parent_slug)
      .sort((a, b) => (ROOT_ORDER[a.slug] ?? 99) - (ROOT_ORDER[b.slug] ?? 99));

    return roots
      .map((r) => ({
        label: r.title,
        slug: r.slug,
        columns: childrenOf(r.slug)
          .filter((c) => populated.has(c.id))
          .map((c) => ({
            heading: c.title,
            slug: c.slug,
            image: c.hero_image_url,
            links: childrenOf(c.slug)
              .filter((s) => populated.has(s.id))
              .map((s) => ({ label: s.title, slug: s.slug })),
          })),
      }))
      .filter((root) => root.columns.length > 0);
  },
  ["nav-tree-v2"],
  { revalidate: 300, tags: ["nav"] },
);
