import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import {
  updateProduct,
  generateProductSeo,
  addProductImages,
  moveProductImage,
  setPrimaryProductImage,
  deleteProductImage,
} from "../actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

type Product = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  provider: string | null;
  provider_product_id: string | null;
  base_cost: number | null;
  featured: boolean;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};
type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sb = createServiceClient();
  const { data } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  const p = data as unknown as Product | null;
  if (!p) notFound();
  const { data: imgData } = await sb
    .from("product_images")
    .select("id, url, alt, sort_order, is_primary")
    .eq("product_id", id)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });
  const images = (imgData as unknown as ProductImage[]) ?? [];

  const onSale = p.compare_at_price != null && p.price < p.compare_at_price;

  return (
    <div className="max-w-xl">
      <Link
        href="/admin/products"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Products
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">{p.title}</h1>
      <p className="mt-1 font-mono text-caption text-ink/50">
        {p.provider ?? "—"}
        {p.provider_product_id ? ` · ${p.provider_product_id}` : ""} ·{" "}
        <Link href={`/products/${p.slug}`} className="text-accent-sun no-underline hover:underline">
          view on store →
        </Link>
      </p>
      {onSale && (
        <p className="mt-3 inline-block rounded-sm border border-accent-sun/40 px-2 py-1 font-mono text-caption text-accent-sun uppercase">
          On sale
        </p>
      )}

      <form action={updateProduct} className="mt-8 space-y-6">
        <input type="hidden" name="product_id" value={p.id} />

        <div className="flex gap-4">
          <Field label={`Price (${p.currency})`}>
            <input
              type="number"
              step="0.01"
              name="price"
              defaultValue={p.price}
              className="mt-2 w-40 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body"
            />
          </Field>
          <Field label={`Compare-at / was (${p.currency})`}>
            <input
              type="number"
              step="0.01"
              name="compare_at_price"
              defaultValue={p.compare_at_price ?? ""}
              placeholder="—"
              className="mt-2 w-40 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body"
            />
          </Field>
        </div>
        <p className="font-mono text-caption text-ink/50">
          Setting price below compare-at marks the product on sale and auto-queues a blog draft.
          {p.base_cost != null && ` Base cost: ${formatPrice(p.base_cost, p.currency)}.`}
        </p>

        <Select label="Status" name="status" defaultValue={p.status} />

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={p.featured}
            className="h-4 w-4 accent-accent-sun"
          />
          <span className="font-body text-body text-ink">Featured on home page</span>
        </label>

        <Field label="Description">
          <textarea
            name="description"
            defaultValue={p.description ?? ""}
            rows={6}
            placeholder="Product description shown on the storefront…"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
        </Field>

        <Field label="SEO title">
          <input
            key={p.seo_title ?? ""}
            type="text"
            name="seo_title"
            defaultValue={p.seo_title ?? ""}
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
        </Field>
        <Field label="SEO description">
          <textarea
            key={p.seo_description ?? ""}
            name="seo_description"
            defaultValue={p.seo_description ?? ""}
            rows={3}
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
            Save
          </SubmitButton>
          <SubmitButton
            formAction={generateProductSeo}
            pendingText="Generating…"
            className="rounded-sm border border-ink/25 px-4 py-3 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun"
          >
            ✨ Generate SEO with AI
          </SubmitButton>
        </div>
      </form>

      {/* ── Photos ──────────────────────────────────────────────────────── */}
      <section className="mt-12 border-t border-ink/10 pt-8">
        <h2 className="font-display text-heading text-ink">Photos</h2>
        <p className="mt-1 font-mono text-caption text-ink/50">
          The primary image is the main one shown in listings. Use ↑ / ↓ to set the gallery order.
        </p>

        <ul className="mt-4 space-y-2">
          {images.map((img, i) => (
            <li
              key={img.id}
              className="flex items-center gap-3 rounded-sm border border-ink/10 p-2"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                {img.is_primary ? (
                  <span className="font-mono text-caption tracking-wide text-accent-sun uppercase">
                    ★ Primary
                  </span>
                ) : (
                  <form action={setPrimaryProductImage}>
                    <input type="hidden" name="image_id" value={img.id} />
                    <SubmitButton
                      pendingText="…"
                      className="font-mono text-caption tracking-wide text-ink/60 uppercase hover:text-accent-sun"
                    >
                      Make primary
                    </SubmitButton>
                  </form>
                )}
                <p className="truncate font-mono text-[11px] text-ink/40">{img.alt || "no alt"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <MoveButton imageId={img.id} dir="up" disabled={i === 0} label="↑" />
                <MoveButton
                  imageId={img.id}
                  dir="down"
                  disabled={i === images.length - 1}
                  label="↓"
                />
                <form action={deleteProductImage}>
                  <input type="hidden" name="image_id" value={img.id} />
                  <SubmitButton
                    pendingText="…"
                    className="rounded-sm border border-ink/15 px-2 py-1 font-mono text-xs text-ink/50 uppercase hover:border-red-400 hover:text-red-500"
                  >
                    Delete
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
          {images.length === 0 && (
            <li className="font-body text-caption text-ink/50">No photos yet.</li>
          )}
        </ul>

        <form action={addProductImages} className="mt-5 flex flex-wrap items-center gap-3">
          <input type="hidden" name="product_id" value={p.id} />
          <input
            type="file"
            name="files"
            accept="image/*"
            multiple
            className="block font-body text-caption text-ink/70 file:mr-3 file:rounded-sm file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-xs file:tracking-widest file:text-surface file:uppercase"
          />
          <SubmitButton
            pendingText="Uploading…"
            className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase"
          >
            Upload photos
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

function MoveButton({
  imageId,
  dir,
  disabled,
  label,
}: {
  imageId: string;
  dir: "up" | "down";
  disabled: boolean;
  label: string;
}) {
  return (
    <form action={moveProductImage}>
      <input type="hidden" name="image_id" value={imageId} />
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        className="rounded-sm border border-ink/15 px-2 py-1 font-mono text-xs text-ink/60 hover:border-accent-sun hover:text-accent-sun disabled:opacity-30"
      >
        {label}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      {children}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
      >
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
    </label>
  );
}
