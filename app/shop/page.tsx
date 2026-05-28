import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { ProductGrid } from "@/components/ProductGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getProducts } from "@/lib/queries";
import { breadcrumbLd } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;
const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece. Coastal lifestyle clothing, printed quietly.",
  alternates: { canonical: absoluteUrl("/shop") },
};

const SORTS = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
] as const;

type Sort = (typeof SORTS)[number]["key"];

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "featured") as Sort;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { products, count } = await getProducts({ limit: PAGE_SIZE, offset, sort });
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const qs = (overrides: Record<string, string>) =>
    new URLSearchParams({ sort, ...overrides }).toString();

  return (
    <Container className="py-16">
      <JsonLd data={breadcrumbLd([{ name: "Shop", path: "/shop" }])} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Shop</h1>
        <nav className="flex gap-3" aria-label="Sort products">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/shop?${qs({ sort: s.key, page: "1" })}`}
              aria-current={sort === s.key}
              className={`font-mono text-caption tracking-wide uppercase underline-offset-4 hover:underline ${
                sort === s.key ? "text-accent-sun" : "text-ink/60"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-10">
        <ProductGrid products={products} />
      </div>

      {totalPages > 1 && (
        <div className="mt-14 flex items-center justify-center gap-6">
          {page > 1 ? (
            <Link
              href={`/shop?${qs({ page: String(page - 1) })}`}
              className="font-mono text-caption tracking-widest text-ink uppercase underline-offset-4 hover:underline"
            >
              ← Prev
            </Link>
          ) : (
            <span className="font-mono text-caption tracking-widest text-ink/30 uppercase">
              ← Prev
            </span>
          )}
          <span className="font-mono text-caption text-ink/60">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/shop?${qs({ page: String(page + 1) })}`}
              className="font-mono text-caption tracking-widest text-ink uppercase underline-offset-4 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span className="font-mono text-caption tracking-widest text-ink/30 uppercase">
              Next →
            </span>
          )}
        </div>
      )}
    </Container>
  );
}
