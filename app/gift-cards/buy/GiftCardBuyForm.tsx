"use client";

import { useState, useTransition } from "react";
import { createGiftCardCheckout } from "../actions";

const PRESETS = [25, 50, 100];
const MIN = 10;
const MAX = 500;

export function GiftCardBuyForm() {
  const [amount, setAmount] = useState<number>(50);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const effectiveAmount = custom.trim() ? Math.round(Number(custom)) : amount;
  const customInvalid =
    custom.trim() !== "" &&
    (!Number.isFinite(Number(custom)) || effectiveAmount < MIN || effectiveAmount > MAX);

  function choosePreset(v: number) {
    setAmount(v);
    setCustom("");
    setErr(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (customInvalid) {
      setErr(`Enter an amount between £${MIN} and £${MAX}.`);
      return;
    }
    start(async () => {
      try {
        const { url, error } = await createGiftCardCheckout({
          amount: effectiveAmount,
          email: email.trim(),
        });
        if (error || !url) {
          setErr(error || "Couldn't start checkout. Try again.");
          return;
        }
        window.location.href = url;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Unexpected error.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Amount</span>
        <div className="mt-3 flex flex-wrap gap-3">
          {PRESETS.map((v) => {
            const active = !custom.trim() && amount === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => choosePreset(v)}
                className={`rounded-sm border px-5 py-3 font-body text-body transition-colors ${
                  active
                    ? "border-accent-sun bg-accent-sun text-surface"
                    : "border-ink/20 text-ink hover:border-ink/40"
                }`}
              >
                £{v}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Or a custom amount (£{MIN}–£{MAX})
        </span>
        <input
          type="number"
          min={MIN}
          max={MAX}
          step={1}
          inputMode="numeric"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setErr(null);
          }}
          placeholder="e.g. 75"
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body"
        />
      </label>

      <label className="block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Your email *
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body"
        />
        <span className="mt-2 block font-mono text-caption text-ink/50">
          We&apos;ll email the gift card code here after payment.
        </span>
      </label>

      {err && <p className="font-mono text-caption text-accent-sun">{err}</p>}

      <button
        type="submit"
        disabled={pending || customInvalid}
        className="w-full rounded-sm bg-accent-sun py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Redirecting…" : `Buy a £${effectiveAmount || 0} gift card`}
      </button>
      <p className="font-mono text-caption text-ink/40">
        Payment handled by Stripe. The card is valid for 12 months and redeemable at checkout.
      </p>
    </form>
  );
}
