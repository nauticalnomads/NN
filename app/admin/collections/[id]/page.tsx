import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ImageSlot } from "../../content/ImageSlot";
import { saveCollection, assignProduct, unassignProduct, generateCollectionSeo } from "../actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

type ProdImg = { url: string; is_primary: boolean; sort_order: number };
type Prod = { id: string; title: string; slug: string; product_images: ProdImg[] };
function thumb(images: ProdImg[]): string | null {
  const sorted = [...(images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return sorted[0]?.url ?? null;
}

type Collection = {
  id: string;
  slug: string;
  title: string;
  gender: string | null;
  parent_slug: string | null;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  hero_image_url: string | null;
};

export default async function CollectionEdit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { q } = await searchParams;
  const sb = createServiceClient();

  const { data } = await sb.from("collections").select("*").eq("id", id).maybeSingle();
  const c = data as unknown as Collection | null;
  if (!c) notFound();

  // Assigned products.
  const { data: assignedRows } = await sb
    .from("collection_products")
    .select(
      "product_id, sort_order, products(id, title, slug, product_images(url, is_primary, sort_order))",
    )
    .eq("collection_id", id)
    .order("sort_order");
  const assigned = (
    (assignedRows ?? []) as unknown as {
      products: Prod | null;
    }[]
  )
    .map((r) => r.products)
    .filter((p): p is Prod => !!p);
  const assignedIds = new Set(assigned.map((p) => p.id));

  // Searchable product list (right side).
  let search = sb
    .from("products")
    .select("id, title, slug, product_images(url, is_primary, sort_order)")
    .order("title")
    .limit(40);
  if (q) search = search.ilike("title", `%${q}%`);
  const { data: foundRows } = await search;
  const found = ((foundRows ?? []) as unknown as Prod[]).filter((p) => !assignedIds.has(p.id));

  // Parent options.
  const { data: parents } = await sb
    .from("collections")
    .select("slug, title")
    .is("parent_slug", null)
    .order("title");
  const parentOpts = (parents as unknown as { slug: string; title: string }[]) ?? [];

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/collections"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Collections
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">{c.title}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Details */}
        <form action={saveCollection} className="space-y-4">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="slug" value={c.slug} />
          <div className="space-y-2">
            <ImageSlot
              name="hero"
              label="Cover photo"
              current={c.hero_image_url ?? undefined}
              rec="1600×600px"
            />
            {c.hero_image_url && (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="hero_remove" className="h-4 w-4 accent-accent-sun" />
                <span className="font-body text-caption text-ink/60">Remove current cover</span>
              </label>
            )}
          </div>
          <Field label="Name">
            <input name="title" defaultValue={c.title} className={input} />
          </Field>
          <Field label="Slug (read-only)">
            <input value={c.slug} readOnly className={`${input} text-ink/50`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <select name="gender" defaultValue={c.gender ?? ""} className={input}>
                <option value="">—</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="accessories">Accessories</option>
                <option value="unisex">Unisex</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={c.status} className={input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>
          </div>
          <Field label="Parent collection">
            <select name="parent_slug" defaultValue={c.parent_slug ?? ""} className={input}>
              <option value="">None (top-level)</option>
              {parentOpts.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SEO title">
            <input
              key={c.seo_title ?? ""}
              name="seo_title"
              defaultValue={c.seo_title ?? ""}
              className={input}
            />
          </Field>
          <Field label="SEO description">
            <textarea
              key={c.seo_description ?? ""}
              name="seo_description"
              defaultValue={c.seo_description ?? ""}
              rows={3}
              className={input}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
              Save details
            </SubmitButton>
            <SubmitButton
              formAction={generateCollectionSeo}
              pendingText="Generating…"
              className="rounded-sm border border-ink/25 px-4 py-3 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun"
            >
              ✨ Generate SEO with AI
            </SubmitButton>
          </div>
        </form>

        {/* Product assignment */}
        <div>
          <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Assigned products ({assigned.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {assigned.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 px-3 py-2"
              >
                <span className="flex items-center gap-3">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                    {thumb(p.product_images) && (
                      <Image
                        src={thumb(p.product_images)!}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="font-body text-body text-ink">{p.title}</span>
                </span>
                <form action={unassignProduct}>
                  <input type="hidden" name="collection_id" value={c.id} />
                  <input type="hidden" name="product_id" value={p.id} />
                  <button className="font-mono text-xs text-accent-sun uppercase">Remove</button>
                </form>
              </li>
            ))}
            {assigned.length === 0 && (
              <li className="font-body text-caption text-ink/50">No products assigned yet.</li>
            )}
          </ul>

          <h2 className="mt-6 font-mono text-caption tracking-wide text-ink/60 uppercase">
            Add products
          </h2>
          <form method="get" className="mt-3 flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search products…"
              className={`${input} flex-1`}
            />
            <button className="rounded-sm border border-ink/20 px-3 font-mono text-xs tracking-widest text-ink/70 uppercase">
              Search
            </button>
          </form>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {found.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 px-3 py-2"
              >
                <span className="flex items-center gap-3">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                    {thumb(p.product_images) && (
                      <Image
                        src={thumb(p.product_images)!}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="font-body text-body text-ink">{p.title}</span>
                </span>
                <form action={assignProduct}>
                  <input type="hidden" name="collection_id" value={c.id} />
                  <input type="hidden" name="product_id" value={p.id} />
                  <button className="font-mono text-xs text-accent-sea uppercase">Add</button>
                </form>
              </li>
            ))}
            {found.length === 0 && (
              <li className="font-body text-caption text-ink/50">No matching products.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

const input =
  "mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      {children}
    </label>
  );
}
