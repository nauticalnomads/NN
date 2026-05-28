#!/usr/bin/env node
/**
 * Nautical Nomads — Shopify → Supabase migration (Session 03).
 *
 * CONTENT SOURCE RULE — non-negotiable:
 *   - Shopify is the SINGLE SOURCE OF TRUTH for customer-facing content:
 *     title, description, SEO, images, option values, SKU.
 *   - Printful / Printify are used ONLY to derive provider mapping
 *     (provider, provider_product_id, provider_variant_id) and base_cost
 *     (for profit reporting). Their titles, descriptions, and images must
 *     NEVER overwrite the Shopify content — half the images and all the text
 *     in Shopify have been edited post-import and have diverged from POD.
 *
 * Pulls all products from the Shopify Admin API (GraphQL), normalises into the
 * new schema, generates clean SKUs, maps each variant to its POD provider via
 * Shopify metafields (namespace `nn`), pulls base_cost from Printful/Printify,
 * uploads images to Supabase Storage, and upserts. Validation-clean products
 * AUTO-PUBLISH; flagged products stay as drafts with reasons.
 *
 * Idempotent — re-running is safe. Use `--dry-run` to report without writing.
 *
 * Auth: OAuth client credentials grant (static Admin API tokens were deprecated
 * in January 2026). See scripts/lib/shopify.mjs.
 *
 * Required env:
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional env:
 *   PRINTFUL_API_KEY, PRINTIFY_API_KEY, PRINTIFY_SHOP_ID
 *   SHOPIFY_API_VERSION   (defaults to 2026-01)
 *   SHOPIFY_IMAGE_HOST    (override the image source host)
 *   MIGRATE_OVERRIDES     (path to a JSON file: { "<shopify-handle>": {provider, provider_product_id, variant_overrides: {<sku>: pvId}} })
 *
 * Usage:
 *   npm run migrate:shopify -- --dry-run
 *   npm run migrate:shopify -- --limit 20
 *   npm run migrate:shopify -- --skip-images
 *   npm run migrate:shopify -- --report ./migration-report.md
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { iterateProducts } from "./lib/shopify.mjs";
import { fetchBaseCost } from "./lib/providers.mjs";

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const DRY_RUN = flag("--dry-run");
const SKIP_IMAGES = flag("--skip-images");
const LIMIT = Number(opt("--limit", 0)) || 0;
const REPORT_PATH = opt("--report", "./migration-report.md");

// ── overrides (optional manual mapping fallback) ─────────────────────────────
const OVERRIDES = (() => {
  const path = process.env.MIGRATE_OVERRIDES;
  if (!path || !existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; }
})();

// ── Supabase service client (bypasses RLS — trusted server context) ──────────
function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PROVIDERS = new Set(["printful", "printify"]);

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
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Generates a clean new SKU. Scheme: NN-{CAT}-{seq:04}-{variantSuffix?}
// CAT comes from product_type (first 3 letters uppercased) or "GEN".
function buildSku(product, variant, seq, variantSeq) {
  const cat = (product.productType || "gen").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "GEN";
  const base = `NN-${cat}-${String(seq).padStart(4, "0")}`;
  const opts = (variant.selectedOptions || []).map((o) => slugify(o.value).slice(0, 6)).join("-");
  return opts ? `${base}-${opts}` : variantSeq ? `${base}-${variantSeq}` : base;
}

// Detect provider + IDs in priority order:
//   1. Shopify metafields (nn.provider, nn.provider_product_id, nn.provider_variant_id)
//   2. MIGRATE_OVERRIDES file (keyed by product handle)
//   3. Tags / SKU patterns ("printful" / "printify")
function detectProviderMapping(product, variant) {
  const meta = (k, obj) => (obj?.[k]?.value ?? "").toString().trim().toLowerCase() || null;

  let provider = meta("provider", product) || meta("provider", variant);
  let providerProductId = meta("provider_product_id", product);
  let providerVariantId = meta("provider_variant_id", variant);

  const override = OVERRIDES[product.handle];
  if (override) {
    provider ||= override.provider;
    providerProductId ||= override.provider_product_id;
    providerVariantId ||= override.variant_overrides?.[variant.sku ?? ""] ?? null;
  }

  if (!provider) {
    const tags = (product.tags || []).map((t) => t.toLowerCase());
    if (tags.includes("printful")) provider = "printful";
    else if (tags.includes("printify")) provider = "printify";
    else {
      const sku = (variant.sku || "").toLowerCase();
      if (sku.includes("printful")) provider = "printful";
      else if (sku.includes("printify")) provider = "printify";
    }
  }

  if (provider && !PROVIDERS.has(provider)) provider = null;
  return { provider, providerProductId, providerVariantId };
}

function validateProduct(p, normalized) {
  const issues = [];
  if (!normalized.description || normalized.description.length < 20)
    issues.push("description thin or missing");
  if ((normalized.images?.length ?? 0) === 0) issues.push("no images");
  if ((normalized.images ?? []).some((i) => !i.alt)) issues.push("image alt text missing");
  if (!normalized.variants?.length) issues.push("no variants");
  for (const v of normalized.variants ?? []) {
    if (!v.provider || !v.provider_variant_id) issues.push(`variant ${v.sku || "?"} has no provider mapping`);
    if (!(v.price > 0)) issues.push(`variant ${v.sku || "?"} has zero/odd price`);
  }
  return issues;
}

// ── image upload (Supabase Storage `product-images` bucket) ──────────────────
async function uploadImage(client, productSlug, idx, srcUrl, alt) {
  if (SKIP_IMAGES || !srcUrl) return { url: srcUrl, alt };
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${productSlug}/${idx}.${ext}`;
    const { error } = await client.storage.from("product-images").upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = client.storage.from("product-images").getPublicUrl(path);
    return { url: data.publicUrl, alt };
  } catch (err) {
    console.warn(`  ⚠ image upload failed for ${productSlug}#${idx}: ${err.message}`);
    return { url: srcUrl, alt };
  }
}

// ── normalise one Shopify product ────────────────────────────────────────────
async function normalise(p, seq, sb) {
  const slug = slugify(p.handle || p.title);
  const description = htmlToText(p.descriptionHtml);
  const productProvider = detectProviderMapping(p, {}).provider;
  const productProviderId = (p.provider_product_id?.value ?? "").trim() || OVERRIDES[p.handle]?.provider_product_id || null;

  const variants = [];
  let vIdx = 0;
  for (const v of p.variants?.nodes ?? []) {
    vIdx++;
    const mapping = detectProviderMapping(p, v);
    const provider = mapping.provider || productProvider;
    const provider_variant_id = mapping.providerVariantId;
    const provider_product_id = mapping.providerProductId || productProviderId;
    const baseCost = await fetchBaseCost(provider, provider_variant_id, provider_product_id);
    const opts = Object.fromEntries((v.selectedOptions || []).map((o) => [o.name.toLowerCase(), o.value]));
    variants.push({
      source_id: v.id,
      sku: buildSku(p, v, seq, vIdx),
      title: v.title === "Default Title" ? null : v.title,
      size: opts.size || null,
      color: opts.color || opts.colour || null,
      price: Number(v.price) || 0,
      base_cost: baseCost,
      provider,
      provider_variant_id,
      provider_product_id,
      sort_order: vIdx - 1,
    });
  }

  const imageNodes = p.images?.nodes ?? (p.featuredImage ? [p.featuredImage] : []);
  const images = [];
  let i = 0;
  for (const img of imageNodes) {
    const uploaded = sb ? await uploadImage(sb, slug, i, img.url, img.altText || p.title) : { url: img.url, alt: img.altText || p.title };
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

  // Upsert product by (source, source_id) — idempotent.
  const { data: existing } = await sb
    .from("products")
    .select("id, status")
    .eq("source", normalized.source)
    .eq("source_id", normalized.source_id)
    .maybeSingle();

  let productId;
  if (existing) {
    // Preserve a manual publish if the owner already promoted a draft.
    if (existing.status === "published") productRow.status = "published";
    const { error } = await sb.from("products").update(productRow).eq("id", existing.id);
    if (error) throw error;
    productId = existing.id;
  } else {
    const { data, error } = await sb.from("products").insert(productRow).select("id").single();
    if (error) throw error;
    productId = data.id;
  }

  // Replace variants (idempotent — match on source_id of the variant).
  for (const v of normalized.variants) {
    const row = { ...v, product_id: productId };
    const { data: ev } = await sb
      .from("variants")
      .select("id")
      .eq("source_id", v.source_id)
      .maybeSingle();
    if (ev) {
      await sb.from("variants").update(row).eq("id", ev.id);
    } else {
      await sb.from("variants").insert(row);
    }
  }

  // Replace images (delete + re-insert — they're identified by URL+order).
  await sb.from("product_images").delete().eq("product_id", productId);
  if (normalized.images.length) {
    await sb.from("product_images").insert(
      normalized.images.map((im) => ({ ...im, product_id: productId })),
    );
  }
  return productId;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nShopify → Supabase migration ${DRY_RUN ? "(DRY RUN)" : ""}\n`);
  const sb = DRY_RUN ? null : supa();
  const report = { clean: 0, flagged: 0, total: 0, flags: [] };

  let seq = 0;
  for await (const p of iterateProducts()) {
    seq++;
    if (LIMIT && seq > LIMIT) break;
    const normalized = await normalise(p, seq, sb);
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
    if (issues.length === 0) {
      report.clean++;
      console.log(`✓ ${normalized.slug}  — ${autoPublish ? "published" : "draft"}`);
    } else {
      report.flagged++;
      report.flags.push({ slug: normalized.slug, title: normalized.title, issues });
      console.log(`✗ ${normalized.slug}  — draft (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
    }
  }

  // ── markdown report ───────────────────────────────────────────────────────
  const lines = [
    `# Migration report${DRY_RUN ? " (DRY RUN)" : ""}`,
    "",
    `- Total: **${report.total}**`,
    `- Auto-published (clean): **${report.clean}**`,
    `- Flagged as drafts: **${report.flagged}**`,
    "",
    "## Flagged products",
    "",
  ];
  for (const f of report.flags) {
    lines.push(`### ${f.title} — \`${f.slug}\``);
    for (const i of f.issues) lines.push(`- ${i}`);
    lines.push("");
  }
  writeFileSync(REPORT_PATH, lines.join("\n"));
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log(`Clean: ${report.clean} · Flagged: ${report.flagged} · Total: ${report.total}\n`);
}

main().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
