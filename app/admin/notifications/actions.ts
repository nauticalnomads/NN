"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function markRead(formData: FormData) {
  await requireOps();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", id);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllRead() {
  await requireOps();
  const sb = createServiceClient();
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .is("read_at", null);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
