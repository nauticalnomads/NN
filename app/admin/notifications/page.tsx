import Link from "next/link";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { NotificationType } from "@/lib/database.types";
import { markAllRead, markRead } from "./actions";

const LABELS: Record<NotificationType, string> = {
  fulfilment_failed: "Fulfilment failed",
  refund_requested: "Refund requested",
  dispute_opened: "Dispute opened",
};

export default async function NotificationsPage() {
  await requireOps();
  const sb = createServiceClient();
  // Unread first (read_at null sorts ahead), then newest first.
  const { data } = await sb
    .from("notifications")
    .select("id, type, title, body, order_id, read_at, created_at")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(200);
  const rows =
    (data as unknown as Array<{
      id: string;
      type: NotificationType;
      title: string;
      body: string | null;
      order_id: string | null;
      read_at: string | null;
      created_at: string;
    }>) || [];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Notifications</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="rounded-sm border border-ink/20 px-3 py-1 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun">
              Mark all read ({unread})
            </button>
          </form>
        )}
      </div>
      <p className="mt-3 font-body text-body text-ink/60">
        Attention-needed events: failed fulfilments, refund requests, and payment disputes. Routine
        orders are not listed here — see Orders.
      </p>

      <ul className="mt-8 space-y-3">
        {rows.map((n) => (
          <li
            key={n.id}
            className={`rounded-sm border px-4 py-4 ${
              n.read_at ? "border-ink/10 bg-surface" : "border-accent-sun/40 bg-surface-2"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {!n.read_at && (
                    <span className="inline-block h-2 w-2 rounded-full bg-accent-sun" aria-hidden />
                  )}
                  <span className="font-mono text-caption tracking-wide text-ink/50 uppercase">
                    {LABELS[n.type] ?? n.type}
                  </span>
                  <span className="font-mono text-caption text-ink/40">
                    {new Date(n.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
                <p className="mt-1 font-body text-body text-ink">{n.title}</p>
                {n.body && <p className="mt-1 font-body text-caption text-ink/70">{n.body}</p>}
                {n.order_id && (
                  <Link
                    href={`/admin/orders/${n.order_id}`}
                    className="mt-1 inline-block font-mono text-caption text-accent-sun no-underline hover:underline"
                  >
                    View order →
                  </Link>
                )}
              </div>
              {!n.read_at && (
                <form action={markRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="shrink-0 rounded-sm border border-ink/20 px-3 py-1 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun">
                    Mark read
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-sm border border-ink/10 px-4 py-8 text-center font-body text-ink/50">
            Nothing needs your attention.
          </li>
        )}
      </ul>
    </div>
  );
}
