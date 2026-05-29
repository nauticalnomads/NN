#!/usr/bin/env node
/**
 * Nautical Nomads — Shopify → Supabase migration (Session 03).
 *
 * CONTENT SOURCE RULE — non-negotiable:
 *   - Shopify is the SINGLE SOURCE OF TRUTH for customer-facing content:
 *     title, description, SEO, images, option values, SKU.
 *   - Printful / Printify are used ONLY to derive provider mapping
 *     (provider, provider_product_id, provider_variant_id) and base_cost.
 *     Their titles, descriptions, and images NEVER overwrite the Shopify
 *     content — half the images and all the text were edited in Shopify
 *     after the original import and have diverged from POD content.
 *
 * JetPrint products (vendor = "JetPrint Fulfillment") are EXCLUDED at source —
 * scope decision; they will not appear on the new site at all.
 *
 * Provider detection (no metafields required — confirmed empirically against
 * this catalogue):
 *   1) Printful sync product whose external_id matches Shopify's
 *      product.legacyResourceId → provider=printful, provider_product_id =
 *      sync_product.id, per-variant provider_variant_id = sync_variant.variant_id
 *      (catalog id). base_cost = catalog variant price (cached per variant_id).
 *   2) Else Printify product whose external.id matches → provider=printify,
 *      provider_product_id = product.id, per-variant provider_variant_id =
 *      variant.id, base_cost = variant.cost / 100.
 *   3) Else SKU pattern `{sync_product_id}_{catalog_variant_id}` → printful
 *      (recovers products with broken sync linkage).
 *   4) Else provider=null (flagged as draft, "no provider mapping").
 *
 * Image-alt fallback: when Shopify alt is empty OR looks like a URL, fall back
 * to the product title. Not an edit to Shopify, just a sensible default at import.
 *
 * Idempotent: re-runnable. Match on (source='shopify', source_id=gid).
 *
 * Usage:
 *   npm run migrate:shopify:dry      — report only, no Supabase writes
 *   npm run migrate:shopify          — real run
 *   npm run migrate:shopify -- --limit 20         — only first N products
 *   npm run migrate:shopify -- --skip-images       — don't upload images
 *   npm run migrate:shopify -- --skip-costs        — don't fetch Printful catalog costs (faster)
 *   npm run migrate:shopify -- --report ./migration-report.md
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { iterateProducts } from "./lib/shopify.mjs";
import { buildPrintfulMap, buildPrintifyMap, printfulCatalogCost } from "./lib/providers.mjs";
import { fetchWithRetry } from "./lib/retry.mjs";

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, fb) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fb;
};
const DRY_RUN = flag("--dry-run");
const SKIP_IMAGES = flag("--skip-images");
const SKIP_COSTS = flag("--skip-costs");
const LIMIT = Number(opt("--limit", 0)) || 0;
const REPORT_PATH = opt("--report", "./migration-report.md");

// ── Supabase service client (bypasses RLS — trusted server context) ──────────
function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── helpers ──────────────────────────────────────────────────────────────────
function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function htmlToText(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Numeric Shopify product id from a gid like "gid://shopify/Product/12345".
function legacyId(gid) {
  if (!gid) return null;
  const m = String(gid).match(/\/(\d+)$/);
  return m ? m[1] : null;
}

// Clean alt text: empty or URL-shaped → product title.
function cleanAlt(rawAlt, fallbackTitle) {
  const v = (rawAlt ?? "").trim();
  if (!v) return fallbackTitle;
  if (/^https?:\/\//i.test(v)) return fallbackTitle;
  return v;
}

// New SKU scheme: NN-{CAT}-{seq:04}-{size?-color?}
function buildSku(product, variant, seq) {
  const cat =
    (product.productType || "gen")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "GEN";
  const base = `NN-${cat}-${String(seq).padStart(4, "0")}`;
  const opts = (variant.selectedOptions || [])
    .map((o) => slugify(o.value).slice(0, 6))
    .filter(Boolean)
    .join("-");
  return opts ? `${base}-${opts}` : base;
}

// Pick provider + IDs for one Shopify product/variant. ONLY mapping fields.
function detectMapping(shopifyProduct, shopifyVariant, pfMap, pyMap) {
  const productLegacy = legacyId(shopifyProduct.id);
  const variantLegacy = legacyId(shopifyVariant.id);

  // 1) Printful (largest provider in this catalogue).
  const pf = pfMap.get(productLegacy);
  if (pf) {
    const sv = pf.syncVariants.find((s) => String(s.external_id) === String(variantLegacy));
    return {
      provider: "printful",
      provider_product_id: pf.syncProduct.id ? String(pf.syncProduct.id) : null,
      provider_variant_id: sv?.variant_id ? String(sv.variant_id) : null,
    };
  }
  // 2) Printify.
  const py = pyMap.get(productLegacy);
  if (py) {
    const pv = (py.variants ?? []).find(
      (v) => String(v.id) === String(variantLegacy) || v.sku === shopifyVariant.sku,
    );
    return {
      provider: "printify",
      provider_product_id: py.id ? String(py.id) : null,
      provider_variant_id: pv?.id ? String(pv.id) : null,
      base_cost_cents: pv?.cost ?? null,
    };
  }
  // 3) Printful SKU-pattern fallback. The Printful Shopify app writes variant
  //    SKUs in the form `{sync_product_id}_{catalog_variant_id}` (e.g.
  //    "8409906_11546"). When the sync linkage is broken or stale, we can
  //    still recover the catalog variant_id (drives base_cost + fulfilment).
  const skuMatch = (shopifyVariant.sku || "").match(/^(\d+)_(\d+)$/);
  if (skuMatch) {
    return {
      provider: "printful",
      provider_product_id: skuMatch[1], // sync_product_id (informational)
      provider_variant_id: skuMatch[2], // catalog variant_id ⇒ what fulfilment needs
    };
  }
  // 4) Unknown.
  return { provider: null };
}

function validateProduct(p, normalized) {
  const issues = [];
  if (!normalized.description || normalized.description.length < 20)
    issues.push("description thin or missing");
  if ((normalized.images?.length ?? 0) === 0) issues.push("no images");
  if (!normalized.variants?.length) issues.push("no variants");
  // Provider mapping is a product-level property; per-variant
  // provider_variant_id is needed by fulfilment on every line.
  if (!normalized.provider) {
    issues.push("no provider mapping");
  } else {
    for (const v of normalized.variants ?? []) {
      if (!v.provider_variant_id) issues.push(`variant ${v.sku || "?"} has no provider_variant_id`);
    }
  }
  for (const v of normalized.variants ?? []) {
    if (!(v.price > 0)) issues.push(`variant ${v.sku || "?"} has zero/odd price`);
  }
  if (
    typeof normalized.compare_at_price === "number" &&
    normalized.compare_at_price <= normalized.price
  ) {
    issues.push("compare_at_price ≤ price (looks reversed — sale badge would mis-trigger)");
  }
  return issues;
}

// ── image upload (Supabase Storage `product-images` bucket) ──────────────────
async function uploadImage(client, productSlug, idx, srcUrl, alt) {
  if (SKIP_IMAGES || !srcUrl) return { url: srcUrl, alt };
  try {
    const res = await fetchWithRetry(srcUrl, {}, { label: `image ${productSlug}#${idx}` });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${productSlug}/${idx}.${ext}`;
    const { error } = await client.storage
      .from("product-images")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw error;
    const { data } = client.storage.from("product-images").getPublicUrl(path);
    return { url: data.publicUrl, alt };
  } catch (err) {
    console.warn(`  ⚠ image upload failed for ${productSlug}#${idx}: ${err.message}`);
    return { url: srcUrl, alt };
  }
}

// ── normalise one Shopify product ────────────────────────────────────────────
async function normalise(p, seq, sb, pfMap, pyMap) {
  const slug = slugify(p.handle || p.title);
  const description = htmlToText(p.descriptionHtml);

  // Provider classification at the product level uses the first variant's mapping.
  const variants = [];
  let vIdx = 0;
  let productProvider = null;
  let productProviderId = null;

  for (const v of p.variants?.nodes ?? []) {
    vIdx++;
    const m = detectMapping(p, v, pfMap, pyMap);
    if (vIdx === 1) {
      productProvider = m.provider;
      productProviderId = m.provider_product_id ?? null;
    }
    // base_cost:
    //   Printify  → variant.cost is already in cents (in-band)
    //   Printful  → catalog lookup, returns major units (£), cached per variant_id
    let baseCost = null;
    if (m.provider === "printify" && typeof m.base_cost_cents === "number") {
      baseCost = m.base_cost_cents / 100;
    } else if (m.provider === "printful" && !SKIP_COSTS && m.provider_variant_id) {
      baseCost = await printfulCatalogCost(m.provider_variant_id);
    }
    const opts = Object.fromEntries(
      (v.selectedOptions || []).map((o) => [o.name.toLowerCase(), o.value]),
    );
    variants.push({
      source_id: v.id,
      sku: buildSku(p, v, seq),
      title: v.title === "Default Title" ? null : v.title,
      size: opts.size || null,
      color: opts.color || opts.colour || null,
      price: Number(v.price) || 0,
      base_cost: baseCost,
      // NB: `provider` lives on the product row, not the variant. We keep
      // provider_variant_id (the per-variant pointer) here for fulfilment.
      provider_variant_id: m.provider_variant_id ?? null,
      sort_order: vIdx - 1,
    });
  }

  // Image alt fallback: empty or URL-looking → product title.
  const imageNodes = p.images?.nodes ?? (p.featuredImage ? [p.featuredImage] : []);
  const images = [];
  let i = 0;
  for (const img of imageNodes) {
    const alt = cleanAlt(img.altText, p.title);
    const uploaded = sb ? await uploadImage(sb, slug, i, img.url, alt) : { url: img.url, alt };
    images.push({ ...uploaded, sort_order: i, is_primary: i === 0 });
    i++;
  }

  const firstVariant = variants[0];
  return {
    source: "shopify",
    source_id: p.id,
    title: p.title,
    slug,
    description,
    seo_title: p.seo?.title || null,
    seo_description: p.seo?.description || null,
    price: firstVariant?.price ?? 0,
    compare_at_price: Number(p.variants?.nodes?.[0]?.compareAtPrice) || null,
    currency: "GBP",
    provider: productProvider,
    provider_product_id: productProviderId,
    base_cost: firstVariant?.base_cost ?? null,
    variants,
    images,
    _vendor: p.vendor,
  };
}

// ── upsert ───────────────────────────────────────────────────────────────────
async function upsertProduct(sb, normalized, autoPublish) {
  const productRow = {
    source: normalized.source,
    source_id: normalized.source_id,
    title: normalized.title,
    slug: normalized.slug,
    description: normalized.description,
    seo_title: normalized.seo_title,
    seo_description: normalized.seo_description,
    price: normalized.price,
    compare_at_price: normalized.compare_at_price,
    currency: normalized.currency,
    provider: normalized.provider,
    provider_product_id: normalized.provider_product_id,
    base_cost: normalized.base_cost,
    status: autoPublish ? "published" : "draft",
    published_at: autoPublish ? new Date().toISOString() : null,
  };

  const { data: existing } = await sb
    .from("products")
    .select("id, status, slug")
    .eq("source", normalized.source)
    .eq("source_id", normalized.source_id)
    .maybeSingle();

  let productId;
  if (existing) {
    if (existing.status === "published") productRow.status = "published"; // never demote a manual publish
    const { error } = await sb.from("products").update(productRow).eq("id", existing.id);
    if (error) throw error;
    productId = existing.id;
  } else {
    // Handle slug collisions (different shopify product, same title).
    const tryRow = { ...productRow };
    let suffix = 1;
    while (true) {
      const { data: ins, error: insErr } = await sb
        .from("products")
        .insert(tryRow)
        .select("id")
        .single();
      if (!insErr) {
        productId = ins.id;
        break;
      }
      if (insErr.code === "23505" && (insErr.message || "").includes("products_slug")) {
        suffix++;
        tryRow.slug = `${productRow.slug}-${suffix}`;
        continue;
      }
      throw insErr;
    }
  }

  // Variants — match on source_id (Shopify variant gid), upsert.
  for (const v of normalized.variants) {
    const { data: ev } = await sb
      .from("variants")
      .select("id")
      .eq("source_id", v.source_id)
      .maybeSingle();
    if (ev) {
      const vRow = { ...v, product_id: productId };
      const { error } = await sb.from("variants").update(vRow).eq("id", ev.id);
      if (error) throw error;
    } else {
      // SKU collision guard — suffix the SKU and retry on unique-violation.
      const tryRow = { ...v, product_id: productId };
      let suffix = 1;
      while (true) {
        const { error } = await sb.from("variants").insert(tryRow);
        if (!error) break;
        if (error.code === "23505" && (error.message || "").includes("variants_sku")) {
          suffix++;
          tryRow.sku = `${v.sku}-${suffix}`;
          continue;
        }
        throw error;
      }
    }
  }

  // Images: replace (Shopify is source of truth, easier than diffing).
  await sb.from("product_images").delete().eq("product_id", productId);
  if (normalized.images.length) {
    await sb
      .from("product_images")
      .insert(normalized.images.map((im) => ({ ...im, product_id: productId })));
  }
  return productId;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nShopify → Supabase migration ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  const sb = DRY_RUN ? null : supa();

  console.log("Building POD lookup maps…");
  const [pfMap, pyMap] = await Promise.all([
    buildPrintfulMap((m) => process.stdout.write(`\r  ${m}    `)),
    buildPrintifyMap(),
  ]);
  process.stdout.write("\n");
  console.log(`  Printful sync products: ${pfMap.size}`);
  console.log(`  Printify products:      ${pyMap.size}`);
  console.log();

  const report = {
    total: 0,
    autoPublished: 0,
    flagged: 0,
    byProvider: { printful: 0, printify: 0, unmapped: 0 },
    flags: [],
    skipped_jetprint: 0,
  };

  let seq = 0;
  for await (const p of iterateProducts()) {
    // Filter JetPrint at source — scope decision (no JetPrint integration).
    if ((p.vendor || "").toLowerCase().includes("jetprint")) {
      report.skipped_jetprint++;
      continue;
    }
    seq++;
    if (LIMIT && seq > LIMIT) break;
    const normalized = await normalise(p, seq, sb, pfMap, pyMap);
    const issues = validateProduct(p, normalized);
    const autoPublish = issues.length === 0;

    if (!DRY_RUN) {
      try {
        await upsertProduct(sb, normalized, autoPublish);
      } catch (err) {
        issues.push(`upsert failed: ${err.message}`);
      }
    }

    report.total++;
    if (issues.length === 0) report.autoPublished++;
    else report.flagged++;

    if (normalized.provider) report.byProvider[normalized.provider]++;
    else report.byProvider.unmapped++;

    if (issues.length === 0) {
      console.log(`✓ ${normalized.slug.padEnd(50)} [${normalized.provider ?? "—"}]  published`);
    } else {
      report.flags.push({
        slug: normalized.slug,
        title: normalized.title,
        provider: normalized.provider,
        vendor: normalized._vendor,
        issues,
      });
      console.log(
        `✗ ${normalized.slug.padEnd(50)} [${normalized.provider ?? "—"}]  draft (${issues.length} issue${issues.length === 1 ? "" : "s"})`,
      );
    }
  }

  // ── markdown report ───────────────────────────────────────────────────────
  const lines = [
    `# Migration report${DRY_RUN ? " (DRY RUN)" : ""}`,
    "",
    `- Total products considered: **${report.total}**`,
    `- Auto-published (clean): **${report.autoPublished}**`,
    `- Flagged as drafts: **${report.flagged}**`,
    `- Skipped (JetPrint at source): **${report.skipped_jetprint}**`,
    "",
    `## Provider breakdown`,
    `- Printful: **${report.byProvider.printful}**`,
    `- Printify: **${report.byProvider.printify}**`,
    `- Unmapped: **${report.byProvider.unmapped}**`,
    "",
    `## Flagged products`,
    "",
  ];
  // Group flags by reason for quick scanning.
  for (const f of report.flags) {
    lines.push(
      `### ${f.title} — \`${f.slug}\`  *${f.provider ?? "unmapped"}, vendor=${f.vendor || "—"}*`,
    );
    for (const i of f.issues) lines.push(`- ${i}`);
    lines.push("");
  }
  writeFileSync(REPORT_PATH, lines.join("\n"));
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(
    `Clean: ${report.autoPublished} · Flagged: ${report.flagged} · Total: ${report.total}`,
  );
  console.log(
    `By provider — printful=${report.byProvider.printful}, printify=${report.byProvider.printify}, unmapped=${report.byProvider.unmapped}`,
  );
  console.log(`Skipped (JetPrint at source): ${report.skipped_jetprint}\n`);
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
