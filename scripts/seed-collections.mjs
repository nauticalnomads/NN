// Seed the category taxonomy as DRAFT collections from the nav config
// (redesign v2 §3.2). Gender landing pages + per-column parents + subcategories.
// Idempotent: upserts on slug. Owner publishes + assigns products in admin.
//   node --env-file=.env.local scripts/seed-collections.mjs
import { createClient } from "@supabase/supabase-js";
import { NAV } from "../lib/navigation.ts";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const rows = [];
let order = 0;
for (const item of NAV) {
  const gender = item.slug === "men" ? "men" : item.slug === "women" ? "women" : "accessories";
  // Gender landing (top-level)
  rows.push({
    slug: item.slug,
    title: item.label,
    gender,
    parent_slug: null,
    sort_order: order++,
    status: "draft",
  });
  for (const col of item.columns) {
    // Column parent
    rows.push({
      slug: col.slug,
      title: col.heading,
      gender,
      parent_slug: item.slug,
      sort_order: order++,
      status: "draft",
    });
    for (const link of col.links) {
      rows.push({
        slug: link.slug,
        title: link.label,
        gender,
        parent_slug: col.slug,
        sort_order: order++,
        status: "draft",
      });
    }
  }
}

// Dedupe by slug (some footwear subcategory slugs are unique per gender already).
const bySlug = new Map();
for (const r of rows) if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);
const unique = [...bySlug.values()];

// Upsert parents first (FK parent_slug references collections.slug), so insert
// top-level, then columns, then leaves — already ordered that way in `unique`.
let ok = 0;
let fail = 0;
for (const r of unique) {
  const { error } = await sb.from("collections").upsert(r, { onConflict: "slug" });
  if (error) {
    fail++;
    console.error("  ✗", r.slug, error.message);
  } else {
    ok++;
  }
}
console.log(`Seeded collections: ${ok} ok, ${fail} failed, ${unique.length} total (all draft).`);
process.exit(fail ? 1 : 0);
