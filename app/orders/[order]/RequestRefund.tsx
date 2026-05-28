"use client";

import { useState, useTransition } from "react";
import { requestRefund } from "./actions";

export function RequestRefund({
  orderId,
  total,
  currency,
}: {
  orderId: string;
  total: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="mt-6 font-mono text-caption text-accent-sea">
        Refund requested. We&apos;ll be in touch.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 font-mono text-caption tracking-widest text-ink/60 uppercase underline-offset-4 hover:text-accent-sun hover:underline"
      >
        Request a refund
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-sm border border-ink/10 bg-surface-2 p-5">
      <p className="font-body text-body text-ink">
        Tell us what happened. We&apos;ll review and respond.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        className="mt-3 block w-full rounded-sm border border-ink/20 bg-surface p-3 font-body text-body"
        placeholder="Optional reason — what went wrong?"
      />
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await requestRefund({ orderId, reason, amount: total, currency });
              setDone(true);
            })
          }
          className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase disabled:opacity-50"
        >
          {pending ? "Sending…" : "Request refund"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-caption tracking-widest text-ink/60 uppercase underline-offset-4 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
