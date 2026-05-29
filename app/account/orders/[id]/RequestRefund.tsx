"use client";

import { useState, useTransition } from "react";
import { requestRefundAuthed } from "../../actions";

export function RequestRefund({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await requestRefundAuthed(formData);
      if (res?.error) setMsg(res.error);
      else if (res?.ok) {
        setDone(true);
        setMsg("Refund requested. We'll be in touch by email.");
      }
    });
  }

  if (done) {
    return <p className="font-body text-caption text-accent-sea">{msg}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-caption tracking-wide text-ink/60 uppercase underline-offset-4 hover:text-accent-sun hover:underline"
      >
        Request a refund
      </button>
    );
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Reason (optional)
        </span>
        <textarea
          name="reason"
          rows={3}
          placeholder="Tell us what went wrong"
          className="mt-2 block w-full max-w-md rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body text-ink"
        />
      </label>
      {msg && <p className="font-mono text-caption text-accent-sun">{msg}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-caption text-ink/50 uppercase hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
