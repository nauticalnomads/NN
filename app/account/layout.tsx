import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { getCustomer } from "@/lib/customer";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

// This layout wraps every /account route, including /account/login. It must NOT
// redirect (that would loop on the login page). When signed in it renders the
// account chrome; otherwise it renders the child plain (e.g. the login page).
// Guarded pages enforce auth themselves via getCustomer() → redirect.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (!customer) return <>{children}</>;

  return (
    <Container className="py-12">
      <div className="flex items-baseline justify-between border-b border-ink/10 pb-5">
        <div>
          <p className="font-mono text-caption tracking-[0.3em] text-accent-sea uppercase">
            Account
          </p>
          <h1 className="mt-1 font-display text-display-2 tracking-tight text-ink">
            {customer.full_name || customer.email}
          </h1>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/account"
            className="font-mono text-caption tracking-wide text-ink/70 uppercase no-underline hover:text-accent-sun"
          >
            Orders
          </Link>
          <form action="/auth/signout?next=/" method="post">
            <button className="font-mono text-caption tracking-wide text-ink/70 uppercase hover:text-accent-sun">
              Sign out
            </button>
          </form>
        </nav>
      </div>
      <div className="mt-8">{children}</div>
    </Container>
  );
}
