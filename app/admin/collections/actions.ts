"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadImage } from "@/lib/storage";
import { generateSeo } from "@/lib/seo";

// AI-fill SEO title + description for a collection (uses its hierarchical name).
export async function generateCollectionSeo(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  const { data } = await sb
    .from("collections")
    .select("title, gender, parent_slug")
    .eq("id", id)
    .maybeSingle();
  const c = data as unknown as {
    title: string;
    gender: string | null;
    parent_slug: string | null;
  } | null;
  if (!c) return;
  let parentTitle = "";
  if (c.parent_slug) {
    const { data: pd } = await sb
      .from("collections")
      .select("title")
      .eq("slug", c.parent_slug)
      .maybeSingle();
    parentTitle = (pd as unknown as { title: string } | null)?.title ?? "";
  }
  const g = c.gender === "men" ? "Men's" : c.gender === "women" ? "Women's" : "";
  const label = [g, parentTitle && parentTitle !== c.title ? parentTitle : "", c.title]
    .filter(Boolean)
    .join(" ")
    .trim();
  const seo = await generateSeo({ label, kind: "product category page" });
  await sb
    .from("collections")
    .update(seo as never)
    .eq("id", id);
  revalidatePath(`/admin/collections/${id}`);
}

// Collections admin (redesign v2 §8). Create/edit collections, assign products,
// bulk-tag ungrouped products. Content admin may manage products/collections.

export async function saveCollection(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const sb = createServiceClient();
  const patch: Record<string, unknown> = {
    title: String(formData.get("title") || "").trim(),
    gender: (String(formData.get("gender") || "") || null) as string | null,
    parent_slug: (String(formData.get("parent_slug") || "") || null) as string | null,
    status: formData.get("status") === "published" ? "published" : "draft",
    seo_title: String(formData.get("seo_title") || "").trim() || null,
    seo_description: String(formData.get("seo_description") || "").trim() || null,
  };

  // Cover photo (auto-cropped client-side). Upload a new file, clear it, or
  // leave the existing one untouched when neither was supplied.
  const heroFile = formData.get("hero_file") as File | null;
  if (formData.get("hero_remove") === "on") {
    patch.hero_image_url = null;
  } else if (heroFile && heroFile.size && id) {
    const url = await uploadImage(heroFile, `collections/${id}`);
    if (url) patch.hero_image_url = url;
  }

  if (id) {
    await sb
      .from("collections")
      .update(patch as never)
      .eq("id", id);
    revalidatePath(`/admin/collections/${id}`);
    revalidatePath(`/collections/${String(formData.get("slug") || "")}`);
  }
  revalidatePath("/admin/collections");
  revalidatePath("/");
  revalidateTag("nav"); // header/mega-menu tree
}

export async function setCollectionStatus(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const status = formData.get("status") === "published" ? "published" : "draft";
  if (!id) return;
  const sb = createServiceClient();
  await sb
    .from("collections")
    .update({ status } as never)
    .eq("id", id);
  revalidatePath("/admin/collections");
  revalidatePath("/");
  revalidateTag("nav"); // header/mega-menu tree
}

export async function assignProduct(formData: FormData): Promise<void> {
  await requireStaff();
  const collectionId = String(formData.get("collection_id") || "");
  const productId = String(formData.get("product_id") || "");
  if (!collectionId || !productId) return;
  const sb = createServiceClient();
  await sb
    .from("collection_products")
    .upsert({ collection_id: collectionId, product_id: productId } as never, {
      onConflict: "collection_id,product_id",
    });
  revalidatePath(`/admin/collections/${collectionId}`);
}

export async function unassignProduct(formData: FormData): Promise<void> {
  await requireStaff();
  const collectionId = String(formData.get("collection_id") || "");
  const productId = String(formData.get("product_id") || "");
  if (!collectionId || !productId) return;
  const sb = createServiceClient();
  await sb
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId)
    .eq("product_id", productId);
  revalidatePath(`/admin/collections/${collectionId}`);
}

// Bulk tagger (§8.3): assign gender + category_slug to many products at once.
export async function bulkTag(formData: FormData): Promise<void> {
  await requireStaff();
  const ids = formData.getAll("product_ids").map(String).filter(Boolean);
  const gender = String(formData.get("gender") || "");
  const category = String(formData.get("category_slug") || "");
  if (!ids.length) return;
  const patch: Record<string, unknown> = {};
  if (gender) patch.gender = gender;
  if (category) patch.category_slug = category;
  if (!Object.keys(patch).length) return;

  const sb = createServiceClient();
  await sb
    .from("products")
    .update(patch as never)
    .in("id", ids);

  // Also add them to the matching collection (so the category page populates).
  if (category) {
    const { data: col } = await sb
      .from("collections")
      .select("id")
      .eq("slug", category)
      .maybeSingle();
    const cid = (col as unknown as { id: string } | null)?.id;
    if (cid) {
      await sb
        .from("collection_products")
        .upsert(ids.map((product_id) => ({ collection_id: cid, product_id })) as never, {
          onConflict: "collection_id,product_id",
        });
    }
  }
  revalidatePath("/admin/collections/tag");
  revalidatePath("/admin/collections");
}
