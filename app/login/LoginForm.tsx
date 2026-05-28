"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(error ?? null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        const supabase = createClient(); // constructed on submit so SSR never touches it
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next || "/admin")}`;
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo, shouldCreateUser: false },
        });
        if (error) setErr(error.message);
        else setSent(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Sign-in is unavailable. Check Supabase env.");
      }
    });
  }

  if (sent) {
    return (
      <div className="mt-10 rounded-sm border border-accent-sea/30 bg-surface-2 p-5">
        <p className="font-body text-body text-ink">Check your inbox.</p>
        <p className="mt-2 font-body text-body text-ink/60">
          We sent a sign-in link to <span className="font-mono">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-5">
      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Email</span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-4 py-3 font-body text-body text-ink focus:border-ink focus:outline-none"
        />
      </label>
      {err && (
        <p className="font-mono text-caption text-accent-sun">
          {err === "forbidden" ? "Insufficient permissions." : err}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
