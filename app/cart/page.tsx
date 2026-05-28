import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { CartReview } from "./CartReview";

export const metadata: Metadata = {
  title: "Bag",
  robots: { index: false, follow: false }, // not for search engines
};

export default function CartPage() {
  return (
    <Container className="py-16">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Your bag</h1>
      <CartReview />
    </Container>
  );
}
