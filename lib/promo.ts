// Percent-off promo codes, redeemable at checkout (server-side only — the
// checkout action validates against this, never the client). Three sources:
//   - Admin-managed codes in the promo_codes table (/admin/promotions), with
//     optional start/end windows and an active toggle.
//   - STUDENT5: fixed 5% student code (revealed on /student-discount after a
//     university-email check; same code for everyone by design).
//   - Newsletter welcome code (default WELCOME10, admin-overridable via the
//     `newsletter.settings` CMS key): 10% off.
import { getCmsValue } from "@/lib/cms";
import { createServiceClient } from "@/lib/supabase/service";

export const STUDENT_CODE = "STUDENT5";
export const STUDENT_PERCENT = 5;

const NEWSLETTER_DEFAULT_CODE = "WELCOME10";
const NEWSLETTER_PERCENT = 10;

export function normalisePromo(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// Admin-managed code lookup: active, inside its start/end window. Best-effort —
// a missing table (migration not yet run) or query failure resolves to null so
// the fixed codes keep working.
async function getManagedPercent(code: string): Promise<number | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("promo_codes")
      .select("percent, active, starts_at, ends_at")
      .eq("code", code)
      .maybeSingle();
    const row = data as unknown as {
      percent: number;
      active: boolean;
      starts_at: string | null;
      ends_at: string | null;
    } | null;
    if (!row || !row.active) return null;
    const now = Date.now();
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return null;
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return null;
    const pct = Number(row.percent);
    return Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : null;
  } catch {
    return null;
  }
}

// Resolve a code → percent off (items subtotal), or null if unknown.
export async function getPromoPercent(code: string): Promise<number | null> {
  const c = normalisePromo(code);
  if (!c) return null;
  const managed = await getManagedPercent(c);
  if (managed != null) return managed;
  if (c === STUDENT_CODE) return STUDENT_PERCENT;
  const cfg = await getCmsValue<{ code?: string }>("newsletter.settings");
  const newsletterCode = normalisePromo((cfg?.code as string) || NEWSLETTER_DEFAULT_CODE);
  if (c === newsletterCode) return NEWSLETTER_PERCENT;
  return null;
}

// University-email check for the student code. Accepts the common academic
// domains: .ac.<cc> (ac.uk, ac.nz, …), .edu and .edu.<cc>.
export function isUniversityEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  const domain = e.split("@")[1];
  return /(\.|^)ac\.[a-z]{2,3}$/.test(domain) || /(\.|^)edu(\.[a-z]{2,3})?$/.test(domain);
}
