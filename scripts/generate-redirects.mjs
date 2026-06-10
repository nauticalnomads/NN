// Generates the 301 redirect map from old Shopify URLs → new platform slugs.
// Read-only against Shopify (paginates products + collections via Admin API)
// and against our Supabase products (slug ↔ source_id). Writes lib/redirects.json
// which next.config.mjs consumes. Re-runnable; safe to run anytime pre-cutover.
//
//   node --env-file=.env.local scripts/generate-redirects.mjs
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { shopifyGraphQL } from "./lib/shopify.mjs";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Manual map for static Shopify pages → our equivalents. Harmless if a source
// path never existed on the old store.
const PAGE_REDIRECTS = [
  { source: "/pages/about", destination: "/about" },
  { source: "/pages/about-us", destination: "/about" },
  { source: "/pages/contact", destination: "/contact" },
  { source: "/pages/contact-us", destination: "/contact" },
  { source: "/pages/shipping", destination: "/shipping-returns" },
  { source: "/pages/shipping-returns", destination: "/shipping-returns" },
  { source: "/pages/returns", destination: "/shipping-returns" },
  { source: "/pages/size-guide", destination: "/size-guide" },
  { source: "/pages/faq", destination: "/shipping-returns" },
  // Shopify blog lived at /blogs/{blog}/{article}; send everything to journal.
  { source: "/blogs/:path*", destination: "/journal" },
  // Bare listing roots.
  { source: "/collections", destination: "/shop" },
  { source: "/products", destination: "/shop" },
];

async function paginate(rootField, selection) {
  const out = [];
  let cursor = null;
  for (;;) {
    const after = cursor ? `, after: "${cursor}"` : "";
    const data = await shopifyGraphQL(
      `{ ${rootField}(first: 100${after}) {
          edges { cursor node { ${selection} } }
          pageInfo { hasNextPage }
        } }`,
    );
    const conn = data[rootField];
    for (const e of conn.edges) out.push(e.node);
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.edges[conn.edges.length - 1].cursor;
  }
  return out;
}

async function main() {
  // Our products: new slug keyed by Shopify gid.
  const slugByGid = new Map();
  {
    let from = 0;
    const page = 1000;
    for (;;) {
      const { data, error } = await sb
        .from("products")
        .select("slug, source_id")
        .eq("source", "shopify")
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const p of data) if (p.source_id) slugByGid.set(p.source_id, p.slug);
      if (data.length < page) break;
      from += page;
    }
  }
  console.log(`Loaded ${slugByGid.size} product slugs from Supabase.`);

  // Our collections: match Shopify gid → new slug where migrated, and keep the
  // set of our slugs so a same-named handle maps to its real collection page
  // (better for SEO than dumping every collection onto /shop).
  const colSlugByGid = new Map();
  const ourColSlugs = new Set();
  {
    const { data, error } = await sb.from("collections").select("slug, source_id");
    if (error) throw new Error(error.message);
    for (const c of data ?? []) {
      if (c.slug) ourColSlugs.add(c.slug);
      if (c.source_id) colSlugByGid.set(c.source_id, c.slug);
    }
  }
  console.log(`Loaded ${ourColSlugs.size} collection slugs from Supabase.`);

  const products = await paginate("products", "id handle");
  const collections = await paginate("collections", "id handle");
  console.log(`Shopify: ${products.length} products, ${collections.length} collections.`);

  const redirects = [];
  const seen = new Set();
  const add = (source, destination) => {
    if (!source || seen.has(source) || source === destination) return;
    seen.add(source);
    redirects.push({ source, destination, permanent: true });
  };

  let matched = 0;
  let dropped = 0;
  for (const p of products) {
    const slug = slugByGid.get(p.id);
    if (slug) {
      matched++;
      add(`/products/${p.handle}`, `/products/${slug}`);
    } else {
      // Dropped product (e.g. the JetPrint watches) — send to /shop, not a 404.
      dropped++;
      add(`/products/${p.handle}`, "/shop");
    }
  }
  // Map each Shopify collection to its new collection page where we have one
  // (by migrated gid, else by same-named slug), otherwise fall back to /shop.
  let colMatched = 0;
  for (const c of collections) {
    const slug = colSlugByGid.get(c.id) ?? (ourColSlugs.has(c.handle) ? c.handle : null);
    if (slug) {
      colMatched++;
      add(`/collections/${c.handle}`, `/collections/${slug}`);
    } else {
      add(`/collections/${c.handle}`, "/shop");
    }
  }

  for (const r of PAGE_REDIRECTS) add(r.source, r.destination);

  redirects.sort((a, b) => a.source.localeCompare(b.source));
  writeFileSync(
    new URL("../lib/redirects.json", import.meta.url),
    JSON.stringify(redirects, null, 2) + "\n",
  );

  console.log(
    `\nWrote lib/redirects.json — ${redirects.length} redirects ` +
      `(${matched} product slug matches, ${dropped} dropped→/shop, ` +
      `${colMatched}/${collections.length} collections mapped to a page, ` +
      `${PAGE_REDIRECTS.length} static).`,
  );
}

main().catch((e) => {
  console.error("generate-redirects failed:", e.message);
  process.exit(1);
});
