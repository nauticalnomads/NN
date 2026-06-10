import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWelcome } from "@/lib/email";
import { ensureReferralCode, linkReferral } from "@/lib/store-credit";

export type Customer = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
};

// The logged-in customer row (scoped by the cookie-bound client + RLS), or null.
// A customer is an auth.users row WITH a matching `customers` row — distinct from
// admins, who have a `public.users` row. Returns null for admins/guests.
export async function getCustomer(): Promise<Customer | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb
      .from("customers")
      .select("id, user_id, email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return (data as unknown as Customer | null) ?? null;
  } catch {
    return null;
  }
}

// Get-or-create the customer row for the currently-authenticated user. On first
// creation: links any existing same-email customer row, backfills the user's
// guest orders (email match, no customer_id) so order history is complete, and
// sends the welcome email. Idempotent — safe to call on every sign-in.
export async function ensureCustomer(): Promise<{ customer: Customer | null; created: boolean }> {
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user || !user.email) return { customer: null, created: false };

  const svc = createServiceClient();

  // Already linked?
  const { data: existingByUser } = await svc
    .from("customers")
    .select("id, user_id, email, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingByUser) {
    return { customer: existingByUser as unknown as Customer, created: false };
  }

  // A legacy row with the same email but no user_id (e.g. created at migration)?
  const { data: existingByEmail } = await svc
    .from("customers")
    .select("id, user_id, email, full_name")
    .eq("email", user.email)
    .is("user_id", null)
    .maybeSingle();

  let customer: Customer;
  if (existingByEmail) {
    const { data: linked } = await svc
      .from("customers")
      .update({ user_id: user.id } as never)
      .eq("id", (existingByEmail as unknown as Customer).id)
      .select("id, user_id, email, full_name")
      .single();
    customer = linked as unknown as Customer;
  } else {
    const { data: created } = await svc
      .from("customers")
      .insert({ user_id: user.id, email: user.email } as never)
      .select("id, user_id, email, full_name")
      .single();
    customer = created as unknown as Customer;
  }

  // Backfill guest orders placed with this email before the account existed.
  await svc
    .from("orders")
    .update({ customer_id: customer.id } as never)
    .eq("email", user.email)
    .is("customer_id", null);

  // Loyalty: give the new account a referral code, and — if they arrived via a
  // referral link — record who referred them (reward paid on their first order).
  await ensureReferralCode(customer).catch(() => undefined);
  try {
    const jar = await cookies();
    const ref = jar.get("nn_ref")?.value;
    if (ref) {
      await linkReferral(customer.id, ref);
      // Best-effort clear; throws in a pure RSC scope (no response to write to).
      try {
        jar.delete("nn_ref");
      } catch {
        /* not in a writable context — harmless, cookie just expires */
      }
    }
  } catch {
    /* no request scope (e.g. scripts) — skip referral linking */
  }

  // Welcome email (fire-and-forget; never blocks sign-in).
  sendWelcome(user.email, customer.full_name ?? undefined).catch(() => undefined);

  return { customer, created: true };
}
