"use client";

import { useRef, useState, useTransition } from "react";
import { submitApplication } from "./actions";

export function ApplyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setResult(null);
    start(async () => {
      try {
        const r = await submitApplication(fd);
        setResult(r);
        if (r.ok) formRef.current?.reset();
      } catch {
        setResult({
          ok: false,
          message: "Something went wrong — email us at info@nauticalnomads.com instead.",
        });
      }
    });
  }

  const inputCls =
    "mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body";
  const fileCls =
    "mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2.5 font-body text-caption text-ink/70 file:mr-3 file:rounded-sm file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-xs file:tracking-widest file:text-surface file:uppercase";

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Name *</span>
          <input type="text" name="name" required className={inputCls} />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Email *
          </span>
          <input type="email" name="email" required className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Tell us about yourself
        </span>
        <textarea
          name="message"
          rows={6}
          placeholder="Who you are, what you'd love to do here, and why the sea matters to you."
          className={inputCls}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            CV (PDF/doc, max 5MB)
          </span>
          <input
            type="file"
            name="cv"
            accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
            className={fileCls}
          />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Cover letter (optional)
          </span>
          <input
            type="file"
            name="cover"
            accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
            className={fileCls}
          />
        </label>
      </div>

      {result && (
        <p
          className={`font-mono text-caption ${result.ok ? "text-accent-sea" : "text-accent-sun"}`}
        >
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send application"}
      </button>
      <p className="font-mono text-caption text-ink/40">
        Your application goes straight to our inbox — we don&apos;t store files on the site.
      </p>
    </form>
  );
}
