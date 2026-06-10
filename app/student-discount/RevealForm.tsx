"use client";

import { useState, useTransition } from "react";
import { revealStudentCode } from "./actions";

export function RevealForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    code?: string;
    percent?: number;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setCopied(false);
    start(async () => {
      try {
        setResult(await revealStudentCode(email.trim()));
      } catch {
        setResult({ ok: false, message: "Something went wrong. Try again." });
      }
    });
  }

  if (result?.ok && result.code) {
    return (
      <div className="rounded-sm border border-accent-sea/30 bg-accent-sea/5 p-6">
        <p className="font-mono text-xs tracking-[0.2em] text-accent-sea uppercase">
          Your {result.percent}% student code
        </p>
        <p className="mt-3 font-mono text-3xl tracking-[0.15em] text-ink">{result.code}</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(result.code ?? "").then(() => setCopied(true));
          }}
          className="mt-4 rounded-sm border border-ink/30 px-4 py-2 font-mono text-xs tracking-widest text-ink uppercase hover:border-ink/60"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <p className="mt-3 font-body text-caption text-ink/60">
          Enter it in the discount code box at checkout. One use per order; can&apos;t be combined
          with other offers.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-sm border border-ink/10 bg-surface-2 p-6">
      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Your university email *
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResult(null);
          }}
          placeholder="you@university.ac.uk"
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body"
        />
      </label>
      {result && !result.ok && (
        <p className="mt-3 font-mono text-caption text-accent-sun">{result.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-sm bg-accent-sun py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Checking…" : "Reveal my code"}
      </button>
      <p className="mt-3 font-mono text-caption text-ink/40">
        We don&apos;t store your email — it&apos;s only checked for a university domain.
      </p>
    </form>
  );
}
