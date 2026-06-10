"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { grantCredit } from "@/lib/store-credit";

// Manually grant store credit to a customer by email (goodwill, support, etc.).
// Master + regular only — content admin is blocked by requireOps.
export async function grantStoreCredit(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requireOps();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim();
  if (!email) return { ok: false, message: "Enter a customer email." };
  if (!(amount > 0)) return { ok: false, message: "Enter an amount greater than zero." };

  const sb = createServiceClient();
  const { data } = await sb.from("customers").select("id, email").eq("email", email).maybeSingle();
  const customer = data as unknown as { id: string; email: string } | null;
  if (!customer) {
    return { ok: false, message: `No customer account found for ${email}.` };
  }

  const granted = await grantCredit({
    customerId: customer.id,
    amount,
    reason: "admin_grant",
    currency: "GBP",
    note: note || null,
    notifyEmail: customer.email,
  });
  if (!granted) return { ok: false, message: "Couldn't grant credit. Try again." };

  revalidatePath("/admin/store-credit");
  return { ok: true, message: `Granted £${amount.toFixed(2)} to ${email}.` };
}
