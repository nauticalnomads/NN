import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using the Nautical Nomads website.",
  alternates: { canonical: absoluteUrl("/terms-of-use") },
};

export default function TermsOfUse() {
  return (
    <Prose title="Terms of Use">
      <p>
        These terms govern your use of this website. By browsing or using the site, you agree to
        them. If you buy something, our{" "}
        <a className="text-accent-sun hover:underline" href="/terms-of-sale">
          Terms of Sale
        </a>{" "}
        also apply.
      </p>

      <h2 className="font-display text-heading text-ink">Acceptable use</h2>
      <p>
        Use the site lawfully and reasonably. Don&apos;t attempt to disrupt or damage it, probe its
        security, access areas you&apos;re not authorised to, or use it to send spam, malware, or
        anything unlawful.
      </p>

      <h2 className="font-display text-heading text-ink">Accounts</h2>
      <p>
        If you create an account, keep your login details secure and don&apos;t share them.
        You&apos;re responsible for activity that happens under your account. Tell us promptly if
        you think it has been compromised.
      </p>

      <h2 className="font-display text-heading text-ink">Intellectual property</h2>
      <p>
        All content on this site — images, text, designs, logos, and the Nautical Nomads name and
        marks — belongs to us or our licensors and is protected by law. You may not copy, reproduce,
        or reuse it for commercial purposes without our written permission.
      </p>

      <h2 className="font-display text-heading text-ink">Availability &amp; accuracy</h2>
      <p>
        We work to keep the site available and its information accurate, but we can&apos;t guarantee
        it will always be uninterrupted or error-free. We may change, suspend, or withdraw parts of
        the site at any time.
      </p>

      <h2 className="font-display text-heading text-ink">Links</h2>
      <p>
        The site may link to third-party sites we don&apos;t control. We&apos;re not responsible for
        their content or practices, and including a link isn&apos;t an endorsement.
      </p>

      <h2 className="font-display text-heading text-ink">Changes &amp; governing law</h2>
      <p>
        We may update the site and these terms from time to time; continued use means you accept the
        current version. These terms are governed by the laws of England and Wales.
      </p>

      <p className="text-ink/50">Last updated: June 2026.</p>
    </Prose>
  );
}
