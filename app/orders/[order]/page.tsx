import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import { ClearCart } from "./ClearCart";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

type OrderRow = {
  id: string;
  email: string;
  status: string;
  grand_total: number;
  currency: string;
  created_at: string;
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const { order } = await params;
  let row: OrderRow | null = null;
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("orders")
      .select("id, email, status, grand_total, currency, created_at")
      .eq("id", order)
      .maybeSingle();
    row = (data as unknown) as OrderRow | null;
  } catch {
    // Storefront is OK without Supabase; show 404.
  }
  if (!row) notFound();
  const r: OrderRow = row;

  const paid = r.status === "paid";

  return (
    <Container className="py-16">
      {paid && <ClearCart />}
      <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Order received</p>
      <h1 className="mt-4 font-display text-display-2 tracking-tight text-ink">
        {paid ? "Thanks — that's in." : "We're confirming your payment…"}
      </h1>
      <p className="mt-4 max-w-md font-body text-body text-ink/70">
        {paid
          ? "We sent a receipt to your email. You'll get a shipping confirmation with tracking as soon as it leaves the printer."
          : "Hang on a moment. If it doesn't update shortly, check your email for the receipt."}
      </p>
      <div className="mt-10 rounded-sm border border-ink/10 p-5 font-mono text-caption text-ink/70">
        <p>Order id: <span className="text-ink">{r.id}</span></p>
        <p>Email:    <span className="text-ink">{r.email}</span></p>
        <p>Total:    <span className="text-ink">{formatPrice(r.grand_total, r.currency)}</span></p>
        <p>Status:   <span className="text-ink uppercase">{r.status}</span></p>
      </div>
    </Container>
  );
}
