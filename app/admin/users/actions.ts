"use server";

import { revalidatePath } from "next/cache";
import { requireMaster } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";

// All actions here are master-only. Service client used because admin invites
// touch auth.admin.inviteUserByEmail() which requires the service role.

export async function inviteUser(formData: FormData) {
  await requireMaster();
  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "content") as UserRole;
  if (!email) return;
  const sb = createServiceClient();
  const { data, error } = await sb.auth.admin.inviteUserByEmail(email);
  if (error || !data?.user) {
    console.error("invite failed:", error?.message);
    return;
  }
  // Mirror to public.users with the chosen role.
  await sb
    .from("users")
    .upsert({ id: data.user.id, email, role, is_active: true } as never);
  revalidatePath("/admin/users");
}

export async function setRole(formData: FormData) {
  await requireMaster();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "content") as UserRole;
  if (!id) return;
  const sb = createServiceClient();
  await sb.from("users").update({ role } as never).eq("id", id);
  revalidatePath("/admin/users");
}

export async function deactivateUser(formData: FormData) {
  await requireMaster();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  const { data } = await sb.from("users").select("is_active").eq("id", id).maybeSingle();
  const row = data as unknown as { is_active: boolean } | null;
  await sb
    .from("users")
    .update({ is_active: !row?.is_active } as never)
    .eq("id", id);
  revalidatePath("/admin/users");
}
