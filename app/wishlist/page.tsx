import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { WishlistGrid } from "./WishlistGrid";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Pieces you've saved.",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <Container className="py-12">
      <h1 className="font-display text-display-2 font-semibold tracking-tight text-deep-ink">
        Wishlist
      </h1>
      <p className="mt-2 font-body text-body text-ink/60">Pieces you&apos;ve saved for later.</p>
      <div className="mt-8">
        <WishlistGrid />
      </div>
    </Container>
  );
}
