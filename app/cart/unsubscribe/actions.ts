"use server";

import { createServiceClient } from "@/lib/supabase/service";

// Records an abandoned-cart email suppression. Defensive: if the
// email_suppressions table isn't migrated yet, it fails quietly and the page
// still shows a confirmation (the link must never 404 or error for a customer).
export async function suppressEmail(email: string): Promise<{ ok: boolean }> {
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) return { ok: false };
  try {
    const sb = createServiceClient();
    await sb
      .from("email_suppressions")
      .upsert({ email: clean, reason: "abandoned_cart_unsubscribe" } as never);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
