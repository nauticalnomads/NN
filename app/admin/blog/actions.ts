"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { uploadImage } from "@/lib/storage";
import { draftFromUrl } from "@/lib/blog";

export async function draftFromUrlAction(formData: FormData) {
  await requireStaff();
  const url = String(formData.get("url") || "").trim();
  if (!url) return;
  const result = await draftFromUrl(url);
  revalidatePath("/admin/blog");
  redirect(`/admin/blog?status=${result.status}`);
}

export async function publishDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  await sb
    .from("blog_posts")
    .update({ status: "published", published_at: new Date().toISOString() } as never)
    .eq("id", id);
  revalidatePath("/admin/blog");
  revalidatePath("/journal");
}

// Edit a post (draft OR published) — title, body, SEO, cover image, status.
export async function saveBlogPost(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();

  const patch: Record<string, unknown> = {
    title: String(formData.get("title") || "").trim(),
    body: String(formData.get("body") || ""),
    excerpt: String(formData.get("excerpt") || "").trim() || null,
    seo_title: String(formData.get("seo_title") || "").trim() || null,
    seo_description: String(formData.get("seo_description") || "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  // Cover image (auto-cropped client-side). Upload new, clear, or keep.
  const coverFile = formData.get("cover_file") as File | null;
  if (formData.get("cover_remove") === "on") {
    patch.cover_image_url = null;
  } else if (coverFile && coverFile.size) {
    const cover = await uploadImage(coverFile, `blog/${id}`);
    if (cover) patch.cover_image_url = cover;
  }

  // Status transition: publishing stamps published_at the first time.
  const status = formData.get("status") === "published" ? "published" : "draft";
  patch.status = status;
  if (status === "published") {
    const { data: cur } = await sb
      .from("blog_posts")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (!(cur as unknown as { published_at?: string } | null)?.published_at) {
      patch.published_at = new Date().toISOString();
    }
  }

  const { data } = await sb
    .from("blog_posts")
    .update(patch as never)
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  const slug = (data as unknown as { slug?: string } | null)?.slug;

  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/journal");
  if (slug) revalidatePath(`/journal/${slug}`);
  redirect("/admin/blog?status=saved");
}

export async function discardDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  await sb
    .from("blog_posts")
    .update({ status: "discarded" } as never)
    .eq("id", id);
  revalidatePath("/admin/blog");
}
