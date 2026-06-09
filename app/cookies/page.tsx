import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How and why Nautical Nomads uses cookies.",
  alternates: { canonical: absoluteUrl("/cookies") },
};

export default function Cookies() {
  return (
    <Prose title="Cookie Policy">
      <p>
        Cookies are small files stored on your device that help a website work and remember your
        choices. We keep our use of them to a minimum.
      </p>

      <h2 className="font-display text-heading text-ink">Essential cookies</h2>
      <p>
        These are required for the shop to function and can&apos;t be switched off. They don&apos;t
        track you for advertising. We use them to:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Keep the items in your bag and wishlist.</li>
        <li>Remember your sign-in session in your account and the admin area.</li>
        <li>Remember your shopping preference (e.g. gender selection).</li>
        <li>Protect the site and process secure checkout via Stripe.</li>
      </ul>

      <h2 className="font-display text-heading text-ink">Analytics</h2>
      <p>
        We don&apos;t currently use analytics or advertising cookies. If we add analytics in future,
        we&apos;ll use a privacy-friendly provider, update this page, and ask for your consent where
        required.
      </p>

      <h2 className="font-display text-heading text-ink">Third parties</h2>
      <p>
        Some essential functions are provided by trusted services (such as Stripe for payment),
        which may set their own cookies needed to deliver those functions securely.
      </p>

      <h2 className="font-display text-heading text-ink">Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings, but note that blocking essential
        cookies will stop parts of the shop — like your bag and checkout — from working.
      </p>

      <p className="text-ink/50">Last updated: June 2026.</p>
    </Prose>
  );
}
