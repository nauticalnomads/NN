import Link from "next/link";
import { Container } from "@/components/Container";
import { ProductGrid } from "@/components/ProductGrid";
import { getFeaturedProducts, getCollections } from "@/lib/queries";

export const revalidate = 300;

export default async function Home() {
  const [featured, collections] = await Promise.all([getFeaturedProducts(8), getCollections()]);

  return (
    <>
      <Container className="py-24 sm:py-32">
        <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">
          Established MMXXIII
        </p>
        <h1 className="mt-6 max-w-4xl font-display text-display-1 leading-[1.05] tracking-tight text-ink">
          Live by the tide.
        </h1>
        <p className="mt-8 max-w-xl font-body text-sub leading-relaxed text-ink/80">
          Coastal lifestyle, printed quietly. We dress people who chase weather, not weekends. Slow
          design, fewer pieces, built to last.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase no-underline transition-opacity hover:opacity-90"
          >
            Shop everything
          </Link>
          <Link
            href="/about"
            className="font-mono text-xs tracking-widest text-ink uppercase underline-offset-4 hover:underline"
          >
            Our story →
          </Link>
        </div>
      </Container>

      {collections.length > 0 && (
        <Container className="pb-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-ink/10 py-5">
            <span className="font-mono text-caption tracking-wide text-ink/50 uppercase">
              Collections
            </span>
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="font-mono text-caption tracking-wide text-ink uppercase underline-offset-4 hover:text-accent-sun hover:underline"
              >
                {c.title}
              </Link>
            ))}
          </div>
        </Container>
      )}

      <Container className="py-16">
        <h2 className="mb-10 font-display text-display-2 tracking-tight text-ink">Featured</h2>
        <ProductGrid
          products={featured}
          emptyMessage="The catalogue lands once products are migrated. Check back soon."
        />
      </Container>
    </>
  );
}
