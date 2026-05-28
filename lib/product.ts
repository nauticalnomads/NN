import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/database.types";

// Used by storefront server pages, the client variant selector, and JSON-LD
// helpers. Pure function — no Supabase / next imports — so it's safe to
// import from "use client" components without dragging server-only code in.
export type ProductWithRelations = ProductRow & {
  variants: VariantRow[];
  product_images: ProductImageRow[];
};

export function primaryImage(product: ProductWithRelations) {
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const img = images[0];
  return img ? { url: img.url, alt: img.alt || product.title } : null;
}
