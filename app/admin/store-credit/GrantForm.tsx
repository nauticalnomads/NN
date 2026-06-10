"use client";

import { useActionState } from "react";
import { grantStoreCredit } from "./actions";

export function GrantForm() {
  const [state, action, pending] = useActionState(grantStoreCredit, null);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="block flex-1">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Customer email
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body text-ink"
          />
        </label>
        <label className="block w-32">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Amount (£)
          </span>
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            required
            placeholder="10.00"
            className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body text-ink"
          />
        </label>
      </div>
      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Note (optional)
        </span>
        <input
          type="text"
          name="note"
          placeholder="e.g. Goodwill — delayed order"
          className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body text-ink"
        />
      </label>
      <button
        disabled={pending}
        className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase disabled:opacity-50"
      >
        {pending ? "Granting…" : "Grant credit"}
      </button>
      {state && (
        <p className={`font-mono text-caption ${state.ok ? "text-accent-sea" : "text-accent-sun"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
