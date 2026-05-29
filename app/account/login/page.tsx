import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { AccountLoginForm } from "./AccountLoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Account</p>
        <h1 className="mt-4 font-display text-display-2 tracking-tight text-ink">Sign in</h1>
        <p className="mt-3 font-body text-body text-ink/60">
          Track orders and request returns. We email you a sign-in link — no password to remember.
          New here? The same link sets up your account.
        </p>
        <AccountLoginForm next={sp.next} error={sp.error} />
      </div>
    </Container>
  );
}
