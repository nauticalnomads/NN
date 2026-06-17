"use client";

import { useState, useTransition } from "react";
import { testConnections } from "./actions";

type Result = { ok: boolean; detail: string };
type Results = { printful: Result; printify: Result; stripe: Result } | null;

// "Test connections" button — pings Printful, Printify and Stripe live with the
// saved credentials and shows whether each actually authenticates (vs. the
// static ✓/✗ above, which only says a key is filled in).
export function ConnectionTester() {
  const [results, setResults] = useState<Results>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setErr(null);
    start(async () => {
      try {
        setResults(await testConnections());
      } catch {
        setErr("Couldn't run the test. Try again.");
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-sm border border-ink/30 px-4 py-2 font-mono text-xs tracking-widest text-ink uppercase transition-colors hover:border-ink/60 disabled:opacity-50"
      >
        {pending ? "Testing…" : "Test connections"}
      </button>

      {err && <p className="mt-3 font-mono text-caption text-accent-sun">{err}</p>}

      {results && (
        <div className="mt-4 space-y-2 rounded-sm border border-ink/10 bg-surface-2/40 p-4">
          <Row label="Printful" r={results.printful} />
          <Row label="Printify" r={results.printify} />
          <Row label="Stripe" r={results.stripe} />
        </div>
      )}
    </div>
  );
}

function Row({ label, r }: { label: string; r: Result }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${
          r.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
        }`}
      >
        {r.ok ? "✓ live" : "✗ fail"}
      </span>
      <span>
        <span className="font-mono text-caption text-ink">{label}</span>
        <span className="block font-mono text-caption text-ink/50">{r.detail}</span>
      </span>
    </div>
  );
}
