import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using this website.",
  alternates: { canonical: absoluteUrl("/terms-of-use") },
};

export default function TermsOfUse() {
  return (
    <Prose title="Terms of Use">
      <p className="text-ink/50 italic">
        Placeholder copy — to be replaced with final, reviewed terms before launch.
      </p>
      <p>
        By using this website you agree to use it lawfully and not to disrupt it, misuse it, or
        attempt to access areas you&apos;re not authorised to.
      </p>
      <p>
        All content — images, text, design, and the brand marks — belongs to Nautical Nomads and may
        not be reproduced without permission.
      </p>
      <p>
        We may update the site, its content, and these terms from time to time. Continued use means
        you accept the current version.
      </p>
    </Prose>
  );
}
