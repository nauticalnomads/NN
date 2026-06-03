import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { suppressEmail } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

// Abandoned-cart unsubscribe landing. The email arrives as a query param from
// the reminder email link. We record the suppression server-side on load.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  let done = false;
  if (email) {
    const res = await suppressEmail(email);
    done = res.ok;
  }

  return (
    <Container className="py-24">
      <div className="max-w-md">
        <h1 className="font-display text-display-2 tracking-tight text-ink">
          {done ? "You're unsubscribed." : "Unsubscribe"}
        </h1>
        <p className="mt-4 font-body text-body text-ink/70">
          {done
            ? "We won't send you any more cart reminders. You'll still get receipts and shipping updates for anything you order — those aren't marketing."
            : "We couldn't read which address to unsubscribe. If you keep getting reminders, reply to one of our emails and we'll sort it."}
        </p>
        <p className="mt-8">
          <Link
            href="/"
            className="font-mono text-caption tracking-widest text-accent-sun uppercase"
          >
            ← Back to Nautical Nomads
          </Link>
        </p>
      </div>
    </Container>
  );
}
