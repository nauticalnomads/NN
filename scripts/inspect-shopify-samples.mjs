#!/usr/bin/env node
/**
 * Nautical Nomads — sample inspection for the Shopify migration.
 *
 * Pulls a small number of Shopify products and prints, side-by-side:
 *   - Shopify: title, handle, vendor, tags, ALL metafields (no namespace
 *     filter — so we can see what the official Printful/Printify apps wrote),
 *     image URLs + alts, every variant's SKU + ALL metafields.
 *   - Printful (if PRINTFUL_API_KEY): the matching `store_products` entry,
 *     looked up by Shopify product numeric ID = `external_id`.
 *   - Printify (if PRINTIFY_API_KEY + PRINTIFY_SHOP_ID): the matching product,
 *     looked up by Shopify numeric ID in `external.id`.
 *
 * Read-only. Does not touch Supabase. Run BEFORE any dry-run import so we can
 * confirm (a) how provider mapping reliably derives for this catalogue, and
 * (b) that the import takes content from Shopify only.
 *
 * Usage:
 *   npm run inspect:shopify
 *   npm run inspect:shopify -- --limit 5
 *   npm run inspect:shopify -- --handles classic-tee,sun-hat
 *   npm run inspect:shopify -- --out ./inspection-report.md
 */
import { writeFileSync } from "node:fs";
import { shopifyGraphQL, iterateProducts as _iter } from "./lib/shopify.mjs";

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const LIMIT = Math.max(1, Math.min(10, Number(opt("--limit", 3)) || 3));
const HANDLES = (opt("--handles", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = opt("--out", null);

// ── Shopify: rich sample query with ALL metafields ───────────────────────────
const SAMPLE_QUERY = /* GraphQL */ `
  query InspectProducts($limit: Int!) {
    products(first: $limit) {
      nodes {
        id
        legacyResourceId
        title
        handle
        productType
        vendor
        tags
        status
        descriptionHtml
        seo { title description }
        featuredImage { url altText }
        images(first: 20) { nodes { url altText } }
        metafields(first: 50) {
          nodes { namespace key type value }
        }
        variants(first: 100) {
          nodes {
            id
            legacyResourceId
            sku
            title
            price
            compareAtPrice
            selectedOptions { name value }
            metafields(first: 30) {
              nodes { namespace key type value }
            }
          }
        }
      }
    }
  }
`;

const HANDLE_QUERY = /* GraphQL */ `
  query InspectByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      legacyResourceId
      title
      handle
      productType
      vendor
      tags
      status
      descriptionHtml
      seo { title description }
      featuredImage { url altText }
      images(first: 20) { nodes { url altText } }
      metafields(first: 50) { nodes { namespace key type value } }
      variants(first: 100) {
        nodes {
          id
          legacyResourceId
          sku
          title
          price
          compareAtPrice
          selectedOptions { name value }
          metafields(first: 30) { nodes { namespace key type value } }
        }
      }
    }
  }
`;

// ── Printful: cache store_products once, then look up by external_id ─────────
let printfulCache = null;
async function loadPrintfulStoreProducts() {
  if (printfulCache !== null) return printfulCache;
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) return (printfulCache = []);
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`https://api.printful.com/store/products?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn(`  Printful store list error ${res.status}: ${await res.text()}`);
      break;
    }
    const json = await res.json();
    const page = json?.result ?? [];
    all.push(...page);
    if (page.length < 100) break;
    offset += 100;
  }
  return (printfulCache = all);
}
async function printfulMatch(shopifyLegacyId) {
  const list = await loadPrintfulStoreProducts();
  const hit = list.find((p) => String(p.external_id ?? "") === String(shopifyLegacyId));
  if (!hit) return null;
  // Fetch sync_variants with their catalog variant_ids and costs.
  const key = process.env.PRINTFUL_API_KEY;
  const det = await fetch(`https://api.printful.com/store/products/${hit.id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!det.ok) return { storeProduct: hit, sync: null };
  const dj = await det.json();
  return {
    storeProduct: hit,
    syncProduct: dj?.result?.sync_product,
    syncVariants: dj?.result?.sync_variants ?? [],
  };
}

// ── Printify: cache shop products once ───────────────────────────────────────
let printifyCache = null;
async function loadPrintifyProducts() {
  if (printifyCache !== null) return printifyCache;
  const key = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!key || !shopId) return (printifyCache = []);
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json?limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn(`  Printify list error ${res.status}: ${await res.text()}`);
      break;
    }
    const json = await res.json();
    const data = json?.data ?? [];
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return (printifyCache = all);
}
function printifyMatch(shopifyLegacyId) {
  return loadPrintifyProducts().then((list) =>
    list.find((p) => String(p?.external?.id ?? "") === String(shopifyLegacyId)) ?? null,
  );
}

// Helper to also list Printify shops (handy if PRINTIFY_SHOP_ID is unknown).
async function listPrintifyShops() {
  const key = process.env.PRINTIFY_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── render ───────────────────────────────────────────────────────────────────
function fence(label, obj) {
  return `**${label}**\n\n\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n`;
}

async function renderProduct(p) {
  const lines = [];
  lines.push(`---\n\n## ${p.title}  \`${p.handle}\``);
  lines.push("");
  lines.push(`- Shopify gid: \`${p.id}\``);
  lines.push(`- Shopify numeric id: \`${p.legacyResourceId}\`  ← what the POD apps use as external_id`);
  lines.push(`- Vendor: \`${p.vendor ?? "—"}\`  ·  Type: \`${p.productType ?? "—"}\`  ·  Status: \`${p.status}\``);
  lines.push(`- Tags: ${(p.tags ?? []).map((t) => "`" + t + "`").join(", ") || "—"}`);
  lines.push(`- SEO title: \`${p.seo?.title ?? "—"}\`  ·  SEO desc: \`${(p.seo?.description ?? "—").slice(0, 80)}\``);
  lines.push(`- Description (first 200): \`${(p.descriptionHtml ?? "").replace(/\s+/g, " ").slice(0, 200)}\``);
  lines.push("");

  lines.push(`**Images (Shopify CDN — these are the ones the migration will use):**`);
  for (const img of p.images?.nodes ?? []) {
    lines.push(`- ${img.url}${img.altText ? `  · alt: "${img.altText}"` : "  · NO ALT"}`);
  }
  lines.push("");

  lines.push(`**Product-level metafields (all namespaces — look for app--printful / app--printify / printful / printify):**`);
  const pm = p.metafields?.nodes ?? [];
  if (pm.length === 0) lines.push("- (none)");
  else for (const m of pm) lines.push(`- \`${m.namespace}.${m.key}\` (${m.type}) = \`${(m.value ?? "").slice(0, 200)}\``);
  lines.push("");

  lines.push(`**Variants (${p.variants?.nodes?.length ?? 0}):**`);
  for (const v of p.variants?.nodes ?? []) {
    lines.push(`- \`${v.sku || "(no sku)"}\`  ·  ${v.title}  ·  £${v.price}${v.compareAtPrice ? ` (compare £${v.compareAtPrice})` : ""}`);
    lines.push(`  - gid: \`${v.id}\`  ·  numeric id: \`${v.legacyResourceId}\``);
    lines.push(`  - options: ${(v.selectedOptions ?? []).map((o) => `${o.name}=${o.value}`).join(", ") || "—"}`);
    const vm = v.metafields?.nodes ?? [];
    if (vm.length === 0) lines.push(`  - metafields: (none)`);
    else for (const m of vm) lines.push(`  - mf: \`${m.namespace}.${m.key}\` = \`${(m.value ?? "").slice(0, 120)}\``);
  }
  lines.push("");

  // ── Printful lookup ────────────────────────────────────────────────────────
  const pf = await printfulMatch(p.legacyResourceId);
  if (pf) {
    lines.push(`### ✓ Printful match (by external_id = \`${p.legacyResourceId}\`)`);
    lines.push(`- Printful sync_product id: **\`${pf.storeProduct.id}\`**  ← this is provider_product_id`);
    lines.push(`- Printful name: \`${pf.storeProduct.name}\` (NOT used — we keep Shopify title)`);
    if (pf.syncVariants?.length) {
      lines.push(`- Sync variants:`);
      for (const sv of pf.syncVariants) {
        lines.push(
          `  - Shopify variant \`${sv.external_id}\` → Printful sync_variant \`${sv.id}\`, ` +
            `catalog variant_id \`${sv.variant_id}\`  ← provider_variant_id  ·  retail £${sv.retail_price}`,
        );
      }
    }
  } else {
    lines.push(`### ✗ No Printful match`);
  }
  lines.push("");

  // ── Printify lookup ────────────────────────────────────────────────────────
  const py = await printifyMatch(p.legacyResourceId);
  if (py) {
    lines.push(`### ✓ Printify match (by external.id = \`${p.legacyResourceId}\`)`);
    lines.push(`- Printify product id: **\`${py.id}\`**  ← this is provider_product_id`);
    lines.push(`- Printify title: \`${py.title}\` (NOT used — we keep Shopify title)`);
    if (py.variants?.length) {
      lines.push(`- Variants (showing first 5):`);
      for (const pv of py.variants.slice(0, 5)) {
        lines.push(
          `  - Printify variant id \`${pv.id}\`  ← provider_variant_id  ·  sku \`${pv.sku}\`  ·  cost £${(pv.cost ?? 0) / 100}  ·  price £${(pv.price ?? 0) / 100}`,
        );
      }
    }
  } else {
    lines.push(`### ✗ No Printify match`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const out = [];
  const push = (s) => out.push(s);

  push(`# Shopify ↔ POD inspection report\n`);
  push(`Read-only sample. Confirms how provider mapping derives for this catalogue.`);
  push(`Image and text columns shown here are ONLY for confirmation — the migration`);
  push(`takes title / description / SEO / images from Shopify exclusively. The POD`);
  push(`APIs supply provider_product_id, provider_variant_id, and base_cost only.\n`);

  // Env diagnostics
  push(`## Environment`);
  push(`- Shopify store: \`${process.env.SHOPIFY_STORE_DOMAIN || "(missing)"}\``);
  push(`- Printful key: ${process.env.PRINTFUL_API_KEY ? "present" : "(missing — will skip Printful lookups)"}`);
  push(`- Printify key: ${process.env.PRINTIFY_API_KEY ? "present" : "(missing — will skip Printify lookups)"}`);
  push(`- Printify shop id: ${process.env.PRINTIFY_SHOP_ID || "(missing)"}`);
  if (process.env.PRINTIFY_API_KEY && !process.env.PRINTIFY_SHOP_ID) {
    const shops = await listPrintifyShops();
    if (shops) push(`\n${fence("Printify shops on this account (pick the Shopify-connected one for PRINTIFY_SHOP_ID)", shops)}`);
  }
  push("");

  // Capture products by handle or by limit
  const products = [];
  if (HANDLES.length) {
    for (const h of HANDLES) {
      const d = await shopifyGraphQL(HANDLE_QUERY, { handle: h });
      if (d.productByHandle) products.push(d.productByHandle);
      else console.warn(`No product for handle "${h}"`);
    }
  } else {
    const d = await shopifyGraphQL(SAMPLE_QUERY, { limit: LIMIT });
    products.push(...(d.products?.nodes ?? []));
  }

  for (const p of products) {
    push(await renderProduct(p));
  }

  // Summary
  const pfHits = (await loadPrintfulStoreProducts()).length;
  const pyHits = (await loadPrintifyProducts()).length;
  push(`## Summary`);
  push(`- Sampled ${products.length} Shopify products`);
  push(`- Printful store_products total: **${pfHits}**`);
  push(`- Printify products total: **${pyHits}**\n`);

  const report = out.join("\n");

  if (OUT) {
    writeFileSync(OUT, report);
    console.log(`\nWrote ${OUT}\n`);
  } else {
    process.stdout.write(report);
  }
}

main().catch((err) => {
  console.error("\nInspection failed:", err);
  process.exit(1);
});

// silence unused import linter (we reuse the auth module's shopifyGraphQL only)
void _iter;
