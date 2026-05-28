import Link from "next/link";
import Image from "next/image";
import type { ProductWithRelations } from "@/lib/product";
import { primaryImage } from "@/lib/product";
import { formatPrice, isOnSale } from "@/lib/format";

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const img = primaryImage(product);
  const onSale = isOnSale(product.price, product.compare_at_price);

  return (
    <Link href={`/products/${product.slug}`} className="group block no-underline">
      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-2">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-3xl text-ink/15">N</span>
          </div>
        )}
        {onSale && (
          <span className="absolute left-3 top-3 rounded-sm bg-accent-sun px-2 py-1 font-mono text-[0.65rem] tracking-widest text-surface uppercase">
            Sale
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="font-body text-body text-ink group-hover:text-accent-sun">
          {product.title}
        </h3>
        <span className="shrink-0 font-mono text-caption text-ink/70">
          {onSale && (
            <span className="mr-2 text-ink/40 line-through">
              {formatPrice(product.compare_at_price, product.currency)}
            </span>
          )}
          {formatPrice(product.price, product.currency)}
        </span>
      </div>
    </Link>
  );
}
