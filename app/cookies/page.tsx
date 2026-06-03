import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How we use cookies.",
  alternates: { canonical: absoluteUrl("/cookies") },
};

export default function Cookies() {
  return (
    <Prose title="Cookie Policy">
      <p className="text-ink/50 italic">
        Placeholder copy — to be replaced with the final, reviewed cookie policy before launch.
      </p>
      <p>
        We use a small number of cookies to make the shop work: keeping your bag and wishlist, your
        sign-in session, and your gender preference. These are essential to the site functioning.
      </p>
      <p>
        If we add analytics later, we&apos;ll use a privacy-friendly provider and update this page.
        We don&apos;t use advertising or cross-site tracking cookies.
      </p>
    </Prose>
  );
}
