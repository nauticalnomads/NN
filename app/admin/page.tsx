import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const sb = await createClient();

  // Cheap headline counts; ignore errors silently — RLS / missing schema is OK.
  async function count(query: PromiseLike<{ count: number | null }>): Promise<number> {
    try {
      return (await query).count ?? 0;
    } catch {
      return 0;
    }
  }
  const [productCount, orderCount, draftCount] = await Promise.all([
    count(sb.from("products").select("id", { head: true, count: "exact" })),
    count(sb.from("orders").select("id", { head: true, count: "exact" })),
    count(sb.from("products").select("id", { head: true, count: "exact" }).eq("status", "draft")),
  ]);

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

      <div className="mt-10 grid grid-cols-3 gap-6">
        <Stat label="Products" value={productCount} />
        <Stat label="Drafts" value={draftCount} />
        <Stat label="Orders" value={orderCount} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-ink/10 bg-surface-2 p-5">
      <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">{label}</p>
      <p className="mt-2 font-display text-heading text-ink">{value}</p>
    </div>
  );
}
