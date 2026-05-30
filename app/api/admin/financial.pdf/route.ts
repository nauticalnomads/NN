import { type NextRequest } from "next/server";
import { requireOps } from "@/lib/auth";
import { getFinancialSummary } from "@/lib/financial";
import { simplePdf } from "@/lib/pdf";
import { formatPrice } from "@/lib/format";

// PDF export of the financial summary for the accountant. Master + regular only.
export async function GET(request: NextRequest) {
  await requireOps();
  const url = new URL(request.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 365 * 86400000);
  const to = toStr ? new Date(toStr) : new Date();

  const s = await getFinancialSummary(from, to);
  const fmt = (n: number) => formatPrice(n, "GBP");
  const period = `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`;

  const pdf = simplePdf([
    { text: "Nautical Nomads", size: 20, gap: 28 },
    { text: "Financial summary", size: 14, gap: 24 },
    { text: `Period: ${period}`, size: 11, gap: 28 },
    { text: `Revenue:              ${fmt(s.revenue)}`, size: 12, gap: 20 },
    { text: `Stripe fees:          ${fmt(s.fees)}`, size: 12, gap: 20 },
    { text: `Refunds issued:       ${fmt(s.refunds)}`, size: 12, gap: 20 },
    { text: `Cost of goods (est):  ${fmt(s.cogs)}`, size: 12, gap: 28 },
    { text: `Estimated profit:     ${fmt(s.profit)}`, size: 14, gap: 30 },
    {
      text: "Revenue - COGS - Stripe fees - refunds. Excludes shipping you pay and FX.",
      size: 9,
      gap: 16,
    },
    {
      text: "Estimates to assist filing - not a substitute for professional accounting.",
      size: 9,
      gap: 16,
    },
    ...(s.stripeUnreachable
      ? [{ text: "NOTE: Stripe was unreachable - revenue/fees may show as 0.", size: 9 }]
      : []),
  ]);

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nn-financial-${from
        .toISOString()
        .slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
