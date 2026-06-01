import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { BulkTagger } from "./BulkTagger";

export default async function BulkTagPage() {
  await requireStaff();
  const sb = createServiceClient();

  // Products missing gender OR category — the ones that need tagging (§8.3).
  const { data: prods } = await sb
    .from("products")
    .select("id, title, gender, category_slug")
    .or("gender.is.null,category_slug.is.null")
    .order("title")
    .limit(500);
  const products =
    (prods as unknown as {
      id: string;
      title: string;
      gender: string | null;
      category_slug: string | null;
    }[]) ?? [];

  // Leaf categories (have a parent) make the best assignment targets.
  const { data: cats } = await sb
    .from("collections")
    .select("slug, title, gender, parent_slug")
    .not("parent_slug", "is", null)
    .order("gender")
    .order("title");
  const categories =
    (cats as unknown as { slug: string; title: string; gender: string | null }[]) ?? [];

  return (
    <div>
      <Link
        href="/admin/collections"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Collections
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">
        Bulk product tagger
      </h1>
      <p className="mt-3 max-w-2xl font-body text-body text-ink/60">
        {products.length} products still need a gender and/or category. Select rows, choose a gender
        and category, and apply. Assigning a category also adds those products to that collection.
      </p>
      <BulkTagger products={products} categories={categories} />
    </div>
  );
}
