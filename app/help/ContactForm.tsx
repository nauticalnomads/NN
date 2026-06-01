"use client";

import { useState } from "react";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement)?.value,
      email: (form.elements.namedItem("email") as HTMLInputElement)?.value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)?.value,
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setState("done");
        setMsg("Thanks — we'll get back to you soon.");
        form.reset();
      } else {
        const d = await res.json().catch(() => ({}));
        setState("error");
        setMsg(d?.error || "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMsg("Something went wrong. Try again.");
    }
  }

  if (state === "done") {
    return <p className="font-body text-body text-deep-ink">{msg}</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="font-body text-caption font-medium text-ink/60">Name</span>
        <input
          name="name"
          required
          className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>
      <label className="block">
        <span className="font-body text-caption font-medium text-ink/60">Email</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>
      <label className="block">
        <span className="font-body text-caption font-medium text-ink/60">Message</span>
        <textarea
          name="message"
          required
          rows={5}
          className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>
      {state === "error" && <p className="font-body text-caption text-terracotta">{msg}</p>}
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-sm bg-terracotta px-6 py-3 font-body text-[14px] font-medium text-hull-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
