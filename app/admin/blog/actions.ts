"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { draftFromUrl } from "@/lib/blog";

export async function draftFromUrlAction(formData: FormData) {
  await requireStaff();
  const url = String(formData.get("url") || "").trim();
  if (!url) return;
  await draftFromUrl(url);
  revalidatePath("/admin/blog");
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
