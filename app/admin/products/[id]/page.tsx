import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import { updateProduct, generateProductSeo } from "../actions";
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
  seo_title: string | null;
  seo_description: string | null;
};

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sb = createServiceClient();
  const { data } = await sb.from("products").select("*").eq("id", id).maybeSingle();
  const p = data as unknown as Product | null;
  if (!p) notFound();

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
    </div>
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
