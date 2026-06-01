import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we handle your data.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function Privacy() {
  return (
    <Prose title="Privacy Policy">
      <p className="text-ink/50 italic">
        Placeholder copy — to be replaced with the final, reviewed privacy policy before launch.
      </p>
      <p>
        We collect only what we need to process your order and run the shop: your name, contact and
        delivery details, and order history. Payment is handled by Stripe; we never see or store
        your full card details.
      </p>
      <p>
        We use your email to send order updates and, if you opt in, occasional news and offers. You
        can unsubscribe from marketing at any time.
      </p>
      <p>
        We don&apos;t sell your data. We share it only with the services needed to fulfil your order
        (payment, print-on-demand fulfilment, shipping, email).
      </p>
      <p>To request a copy of your data or its deletion, contact us via the help page.</p>
    </Prose>
  );
}
