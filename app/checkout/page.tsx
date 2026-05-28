import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Container className="py-12">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Checkout</h1>
      <p className="mt-3 max-w-md font-body text-body text-ink/60">
        Email first (so we can send your receipt and tracking), then where to ship.
      </p>
      <CheckoutForm />
    </Container>
  );
}
