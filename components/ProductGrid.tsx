import type { ProductWithRelations } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";

export function ProductGrid({
  products,
  emptyMessage = "Nothing here yet. The tide's still coming in.",
}: {
  products: ProductWithRelations[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-ink/20 py-20 text-center">
        <p className="font-body text-body text-ink/50">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
