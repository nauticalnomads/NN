import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Admin</p>
        <h1 className="mt-4 font-display text-display-2 tracking-tight text-ink">Sign in</h1>
        <p className="mt-3 font-body text-body text-ink/60">
          Owner and team access only. Magic link arrives by email.
        </p>
        <LoginForm next={sp.next} error={sp.error} />
      </div>
    </Container>
  );
}
