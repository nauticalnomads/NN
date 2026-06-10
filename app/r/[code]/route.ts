import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/site";
import { normaliseReferralCode } from "@/lib/store-credit";

// Referral landing: /r/CODE drops a 60-day cookie with the referrer's code and
// bounces to the homepage. When the visitor later creates an account,
// ensureCustomer() reads the cookie and records who referred them; the reward
// is paid to both parties on the new customer's first paid order.
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const norm = normaliseReferralCode(code ?? "");
  const res = NextResponse.redirect(absoluteUrl("/?ref=1"));
  if (norm) {
    res.cookies.set("nn_ref", norm, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });
  }
  return res;
}
