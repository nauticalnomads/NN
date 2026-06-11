import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";

// Order statuses that represent real, paid revenue (exclude pending/cancelled/refunded).
const PAID_STATUSES = ["paid", "awaiting_fulfilment", "fulfilling", "shipped", "delivered"];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const sb = await createClient();
  const isOps = user.role === "master" || user.role === "regular";

  // Cheap headline counts; ignore errors silently — RLS / missing schema is OK.
  async function count(query: PromiseLike<{ count: number | null }>): Promise<number> {
    try {
      return (await query).count ?? 0;
    } catch {
      return 0;
    }
  }

  const [productCount, orderCount, draftCount, unreadCount] = await Promise.all([
    count(sb.from("products").select("id", { head: true, count: "exact" })),
    count(sb.from("orders").select("id", { head: true, count: "exact" })),
    count(sb.from("products").select("id", { head: true, count: "exact" }).eq("status", "draft")),
    isOps
      ? count(
          sb.from("notifications").select("id", { head: true, count: "exact" }).is("read_at", null),
        )
      : Promise.resolve(0),
  ]);

  // Financial KPIs (service client — this page is already staff-gated, and some of
  // these tables are service-role only). All best-effort: any failure → zeroes.
  const kpis = isOps ? await loadKpis() : null;

  return (
    <div className="max-w-4xl">
      {sp.error === "forbidden" && (
        <div className="mb-6 rounded-sm border border-accent-sun/40 bg-surface-2 px-4 py-3 font-mono text-caption text-accent-sun">
          Insufficient permissions for that page.
        </div>
      )}
      <h1 className="font-display text-display-2 tracking-tight text-ink">
        Hello, {user.full_name || user.email}.
      </h1>
      <p className="mt-3 font-body text-body text-ink/70">role: {user.role}</p>

      {kpis && (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Revenue today" value={formatPrice(kpis.revenueToday, "GBP")} />
            <Stat label="Revenue 7 days" value={formatPrice(kpis.revenueWeek, "GBP")} />
            <Stat label="Orders today" value={kpis.ordersToday} />
            <Stat
              label="Needs action"
              value={kpis.needsAction}
              href={kpis.needsAction > 0 ? "/admin/orders" : undefined}
              alert={kpis.needsAction > 0}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Open carts (7d)" value={kpis.openCarts} />
            <Stat
              label="Credit liability"
              value={formatPrice(kpis.creditLiability, "GBP")}
              href="/admin/store-credit"
            />
            <Stat label="Products" value={productCount} href="/admin/products" />
            <Stat label="Drafts" value={draftCount} />
          </div>
        </>
      )}

      {!kpis && (
        <div className="mt-10 grid grid-cols-3 gap-4">
          <Stat label="Products" value={productCount} />
          <Stat label="Drafts" value={draftCount} />
          <Stat label="Orders" value={orderCount} />
        </div>
      )}

      {isOps && unreadCount > 0 && (
        <Link
          href="/admin/notifications"
          className="mt-6 block rounded-sm border border-accent-sun/40 bg-surface-2 px-4 py-3 font-mono text-caption text-accent-sun no-underline hover:border-accent-sun"
        >
          {unreadCount} notification{unreadCount === 1 ? "" : "s"} need your attention →
        </Link>
      )}
    </div>
  );
}

type Kpis = {
  revenueToday: number;
  revenueWeek: number;
  ordersToday: number;
  needsAction: number;
  openCarts: number;
  creditLiability: number;
};

async function loadKpis(): Promise<Kpis> {
  const empty: Kpis = {
    revenueToday: 0,
    revenueWeek: 0,
    ordersToday: 0,
    needsAction: 0,
    openCarts: 0,
    creditLiability: 0,
  };
  try {
    const svc = createServiceClient();
    const now = new Date();
    const startToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const [paidRes, actionRes, cartsRes, creditRes] = await Promise.all([
      svc
        .from("orders")
        .select("grand_total, created_at")
        .in("status", PAID_STATUSES)
        .gte("created_at", weekAgo),
      svc
        .from("orders")
        .select("id", { head: true, count: "exact" })
        .in("status", ["awaiting_fulfilment", "fulfilment_failed"]),
      svc
        .from("orders")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending")
        .gte("created_at", weekAgo),
      svc.from("store_credit_transactions").select("amount").eq("status", "applied"),
    ]);

    const paid = (paidRes.data as unknown as { grand_total: number; created_at: string }[]) ?? [];
    const revenueWeek = paid.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const todays = paid.filter((o) => o.created_at >= startToday);
    const revenueToday = todays.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const credits = (creditRes.data as unknown as { amount: number }[]) ?? [];
    const creditLiability = credits.reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      revenueToday,
      revenueWeek,
      ordersToday: todays.length,
      needsAction: actionRes.count ?? 0,
      openCarts: cartsRes.count ?? 0,
      creditLiability: Math.max(0, creditLiability),
    };
  } catch {
    return empty;
  }
}

function Stat({
  label,
  value,
  href,
  alert,
}: {
  label: string;
  value: number | string;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-sm border bg-surface-2 p-5 ${
        alert ? "border-accent-sun/50" : "border-ink/10"
      } ${href ? "transition-colors hover:border-ink/40" : ""}`}
    >
      <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">{label}</p>
      <p className={`mt-2 font-display text-heading ${alert ? "text-accent-sun" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}
