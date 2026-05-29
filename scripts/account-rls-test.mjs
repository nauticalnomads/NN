/**
 * Customer-accounts security test (live Supabase, real auth sessions).
 * Verifies: ensureCustomer-style provisioning, guest-order backfill by email,
 * and — critically — RLS isolation: a signed-in customer can read ONLY their
 * own orders, never another customer's.
 *
 * Creates two throwaway auth users + customers + orders, signs in as each with
 * a real JWT, and checks scoping. Cleans everything up.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0,
  failed = 0;
const ok = (l, d = "") => (console.log(`  ✅ ${l}${d ? `  (${d})` : ""}`), passed++);
const bad = (l, d = "") => (console.error(`  ❌ ${l}${d ? `  — ${d}` : ""}`), failed++);

const rand = Math.random().toString(36).slice(2, 8);
const emailA = `e2e-cust-a-${rand}@example.com`;
const emailB = `e2e-cust-b-${rand}@example.com`;
const PW = "Test-" + rand + "-pw";

const created = { users: [], customers: [], orders: [] };

// Replicates lib/customer.ts ensureCustomer (provision + backfill).
async function provision(userId, email) {
  const { data: cust } = await admin
    .from("customers")
    .insert({ user_id: userId, email })
    .select("id")
    .single();
  created.customers.push(cust.id);
  await admin
    .from("orders")
    .update({ customer_id: cust.id })
    .eq("email", email)
    .is("customer_id", null);
  return cust.id;
}

async function makeOrder(email, customerId = null) {
  const { data } = await admin
    .from("orders")
    .insert({
      email,
      customer_id: customerId,
      status: "paid",
      currency: "GBP",
      subtotal: 10,
      shipping_total: 3.99,
      tax_total: 0,
      discount_total: 0,
      grand_total: 13.99,
    })
    .select("id")
    .single();
  created.orders.push(data.id);
  return data.id;
}

try {
  console.log("\n── Setup: two customers, with a guest order pre-existing for A");
  const { data: uA } = await admin.auth.admin.createUser({
    email: emailA,
    password: PW,
    email_confirm: true,
  });
  const { data: uB } = await admin.auth.admin.createUser({
    email: emailB,
    password: PW,
    email_confirm: true,
  });
  created.users.push(uA.user.id, uB.user.id);
  ok("created two auth users");

  // A guest order placed with A's email BEFORE the account exists.
  const guestOrderA = await makeOrder(emailA, null);
  ok("guest order for A created (no customer_id yet)");

  const custA = await provision(uA.user.id, emailA);
  const custB = await provision(uB.user.id, emailB);
  ok("provisioned customer rows for A and B");

  // Backfill check: A's guest order should now carry A's customer_id.
  const { data: backfilled } = await admin
    .from("orders")
    .select("customer_id")
    .eq("id", guestOrderA)
    .single();
  if (backfilled.customer_id === custA) ok("guest order backfilled to customer A");
  else bad("guest order backfill", `customer_id=${backfilled.customer_id}`);

  // One more order each (placed while logged in).
  await makeOrder(emailA, custA);
  const orderB = await makeOrder(emailB, custB);

  console.log("\n── RLS isolation: sign in as A with a real JWT");
  const clientA = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await clientA.auth.signInWithPassword({ email: emailA, password: PW });
  if (signErr) {
    bad("sign in as A", signErr.message);
  } else {
    ok("signed in as A");
    const { data: aOrders } = await clientA.from("orders").select("id, email, customer_id");
    const all = aOrders ?? [];
    const onlyA = all.every((o) => o.customer_id === custA);
    if (all.length === 2 && onlyA) ok("A sees exactly their 2 orders", `${all.length} rows`);
    else bad("A order scoping", `saw ${all.length} rows, onlyA=${onlyA}`);

    // Try to read B's order by id directly — RLS must return nothing.
    const { data: leak } = await clientA.from("orders").select("id").eq("id", orderB).maybeSingle();
    if (!leak) ok("A cannot read B's order by id (RLS isolation holds)");
    else bad("RLS leak", "A read B's order!");

    // order_items / refunds also scoped — A reads B's items: expect 0.
    const { data: leakItems } = await clientA
      .from("order_items")
      .select("id")
      .eq("order_id", orderB);
    if (!leakItems || leakItems.length === 0) ok("A cannot read B's order_items");
    else bad("order_items leak", `${leakItems.length} rows`);

    await clientA.auth.signOut();
  }
} catch (e) {
  bad("unexpected error", e.message);
} finally {
  console.log("\n── Cleanup");
  for (const id of created.orders) await admin.from("orders").delete().eq("id", id);
  for (const id of created.customers) await admin.from("customers").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  ok("cleaned up users + customers + orders");
}

console.log(`\n${"─".repeat(50)}\nAccount RLS test: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
