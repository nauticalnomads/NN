import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { STUDENT_CODE, STUDENT_PERCENT } from "@/lib/promo";
import { createPromoCode, setPromoActive, deletePromoCode } from "./actions";

export const metadata = { title: "Promotions", robots: { index: false, follow: false } };

const NOTICE: Record<string, { text: string; warn: boolean }> = {
  created: { text: "Code created — it works at checkout immediately.", warn: false },
  duplicate: { text: "That code already exists.", warn: true },
  bad_code: { text: "Codes need at least 3 characters.", warn: true },
  bad_percent: { text: "Percent must be between 1 and 100.", warn: true },
  migrate: {
    text: "Couldn't save — run the promo_codes migration (supabase/migrations/20260612200000_promo_codes.sql) first.",
    warn: true,
  },
};

type Promo = {
  id: string;
  code: string;
  percent: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  created_at: string;
};

export default async function AdminPromotions({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireOps();
  const { notice = "" } = await searchParams;
  const banner = NOTICE[notice];

  let codes: Promo[] = [];
  let tableMissing = false;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("promo_codes")
      .select("id, code, percent, active, starts_at, ends_at, note, created_at")
      .order("created_at", { ascending: false });
    if (error) tableMissing = true;
    codes = (data as unknown as Promo[]) ?? [];
  } catch {
    tableMissing = true;
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB") : null);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Promotions</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Percent-off codes redeemed at checkout. The fixed {STUDENT_CODE} ({STUDENT_PERCENT}%
        student) and newsletter welcome codes keep working alongside these.
      </p>

      {banner && (
        <div
          className={`mt-6 rounded-sm border px-4 py-3 font-body text-caption text-ink ${
            banner.warn
              ? "border-accent-sun/40 bg-accent-sun/5"
              : "border-accent-sea/30 bg-accent-sea/5"
          }`}
        >
          {banner.text}
        </div>
      )}
      {tableMissing && !banner && (
        <div className="mt-6 rounded-sm border border-accent-sun/40 bg-accent-sun/5 px-4 py-3 font-body text-caption text-ink">
          Run the one-time migration to enable managed codes:{" "}
          <code className="font-mono">supabase/migrations/20260612200000_promo_codes.sql</code>
        </div>
      )}

      <form
        action={createPromoCode}
        className="mt-8 grid gap-4 rounded-sm border border-ink/10 bg-surface-2 p-5 sm:grid-cols-2"
      >
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Code *</span>
          <input
            name="code"
            required
            placeholder="SUMMER15"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body uppercase"
          />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Percent off *
          </span>
          <input
            name="percent"
            required
            type="number"
            min={1}
            max={100}
            step="0.5"
            placeholder="15"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body"
          />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Starts (optional)
          </span>
          <input
            name="starts_at"
            type="datetime-local"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption"
          />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Ends (optional)
          </span>
          <input
            name="ends_at"
            type="datetime-local"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Note (internal)
          </span>
          <input
            name="note"
            placeholder="Summer campaign — IG bio link"
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
        </label>
        <div className="sm:col-span-2">
          <button className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90">
            Create code
          </button>
        </div>
      </form>

      <h2 className="mt-10 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Codes ({codes.length})
      </h2>
      <ul className="mt-4 space-y-2">
        {codes.map((c) => {
          const now = Date.now();
          const expired = c.ends_at ? new Date(c.ends_at).getTime() < now : false;
          const notStarted = c.starts_at ? new Date(c.starts_at).getTime() > now : false;
          const live = c.active && !expired && !notStarted;
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ink/10 p-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-body text-ink">
                  {c.code} <span className="text-ink/50">— {Number(c.percent)}% off</span>{" "}
                  <span
                    className={`ml-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase ${
                      live ? "bg-accent-sea/10 text-accent-sea" : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {live ? "Live" : expired ? "Expired" : notStarted ? "Scheduled" : "Off"}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-caption text-ink/45">
                  {[
                    fmt(c.starts_at) && `from ${fmt(c.starts_at)}`,
                    fmt(c.ends_at) && `until ${fmt(c.ends_at)}`,
                    c.note,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No schedule — runs until turned off"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <form action={setPromoActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(!c.active)} />
                  <button className="font-mono text-caption tracking-widest text-ink/70 uppercase underline-offset-4 hover:underline">
                    {c.active ? "Turn off" : "Turn on"}
                  </button>
                </form>
                <form action={deletePromoCode}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="font-mono text-caption tracking-widest text-ink/50 uppercase underline-offset-4 hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {codes.length === 0 && !tableMissing && (
          <p className="font-body text-body text-ink/50">No codes yet — create one above.</p>
        )}
      </ul>
    </div>
  );
}
