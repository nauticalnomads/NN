import { requireOps } from "@/lib/auth";
import { StubPage } from "@/components/admin/StubPage";

export default async function AdminFinancial() {
  await requireOps();
  return (
    <StubPage
      session="Session 09"
      title="Financial"
      blurb="Revenue, Stripe fees, refunds, cost-of-goods and estimated profit by date range. CSV/PDF exports for the accountant. Estimates only — not a substitute for accounting."
    />
  );
}
