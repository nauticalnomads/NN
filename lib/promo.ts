// Percent-off promo codes, redeemable at checkout (server-side only — the
// checkout action validates against this, never the client). Two sources:
//   - STUDENT5: fixed 5% student code (revealed on /student-discount after a
//     university-email check; same code for everyone by design).
//   - Newsletter welcome code (default WELCOME10, admin-overridable via the
//     `newsletter.settings` CMS key): 10% off.
import { getCmsValue } from "@/lib/cms";

export const STUDENT_CODE = "STUDENT5";
export const STUDENT_PERCENT = 5;

const NEWSLETTER_DEFAULT_CODE = "WELCOME10";
const NEWSLETTER_PERCENT = 10;

export function normalisePromo(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// Resolve a code → percent off (items subtotal), or null if unknown.
export async function getPromoPercent(code: string): Promise<number | null> {
  const c = normalisePromo(code);
  if (!c) return null;
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
