"use client";

import { useState } from "react";

// Newsletter signup form (redesign v2 §6.1). POSTs to /api/newsletter/subscribe,
// shows inline success/error. Email-capture only (Resend + Supabase, no ESP).
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
        setMsg("You're in. Check your inbox.");
      } else {
        setState("error");
        setMsg(data?.error || "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMsg("Something went wrong. Try again.");
    }
  }

  if (state === "done") {
    return <p className="font-body text-[14px] text-deep-ink">{msg}</p>;
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md gap-2">
      <label className="sr-only" htmlFor="nl-email">
        Email address
      </label>
      <input
        id="nl-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className="h-11 flex-1 rounded-sm border border-deep-ink bg-hull-white px-3 font-body text-[14px] text-deep-ink placeholder:text-driftwood-tan focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="h-11 shrink-0 rounded-sm bg-deep-ink px-5 font-body text-[13px] font-medium text-hull-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === "loading" ? "…" : "Subscribe"}
      </button>
      {state === "error" && (
        <span className="sr-only" role="alert">
          {msg}
        </span>
      )}
    </form>
  );
}
