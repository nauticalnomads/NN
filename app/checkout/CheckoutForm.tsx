"use client";

import { useEffect, useState, useTransition } from "react";
import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { formatPrice } from "@/lib/format";
import { createCheckoutSession, previewPromoAction, getStoreCreditPreview } from "./actions";
import { previewGiftCardAction } from "@/app/gift-cards/actions";
import { TrustBadges } from "@/components/TrustBadges";

type GiftInfo = { valid: boolean; balance?: number; currency?: string; message: string };
type PromoInfo = { valid: boolean; percent?: number; message: string };

export function CheckoutForm() {
  const { items, subtotal } = useCart();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("GB");
  const [gcCode, setGcCode] = useState("");
  const [gcInfo, setGcInfo] = useState<GiftInfo | null>(null);
  const [gcPending, startGc] = useTransition();
  const [promoCode, setPromoCode] = useState("");
  const [promoInfo, setPromoInfo] = useState<PromoInfo | null>(null);
  const [promoPending, startPromo] = useTransition();
  const [credit, setCredit] = useState<{ balance: number; currency: string }>({
    balance: 0,
    currency: "GBP",
  });
  const [useCredit, setUseCredit] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Signed-in customers can spend their store credit; guests get { balance: 0 }.
  useEffect(() => {
    getStoreCreditPreview()
      .then(setCredit)
      .catch(() => undefined);
  }, []);

  function applyGiftCard() {
    if (!gcCode.trim()) return;
    setGcInfo(null);
    startGc(async () => {
      try {
        setGcInfo(await previewGiftCardAction(gcCode.trim()));
      } catch {
        setGcInfo({ valid: false, message: "Couldn't check that code. Try again." });
      }
    });
  }

  function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoInfo(null);
    startPromo(async () => {
      try {
        setPromoInfo(await previewPromoAction(promoCode.trim()));
      } catch {
        setPromoInfo({ valid: false, message: "Couldn't check that code. Try again." });
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="mt-12 font-body text-body text-ink/50">
        Your bag is empty.{" "}
        <a className="text-accent-sun hover:underline" href="/shop">
          Browse the shop
        </a>
        .
      </p>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        const { url, error } = await createCheckoutSession({
          email: email.trim(),
          shipping_address: {
            name: name.trim(),
            line1: address1.trim(),
            line2: address2.trim() || undefined,
            city: city.trim(),
            postal_code: postal.trim(),
            country,
          },
          items: items.map((i): CartItem => ({ ...i })),
          giftCardCode: gcInfo?.valid ? gcCode.trim() : undefined,
          promoCode: promoInfo?.valid ? promoCode.trim() : undefined,
          useStoreCredit: credit.balance > 0 && useCredit,
        });
        if (error || !url) {
          setErr(error || "Checkout unavailable. Try again in a moment.");
          return;
        }
        window.location.href = url;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Unexpected error.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Field label="Email" type="email" required value={email} onChange={setEmail} />
        <h2 className="border-t border-ink/10 pt-6 font-mono text-caption tracking-wide text-ink/60 uppercase">
          Shipping address
        </h2>
        <Field label="Full name" required value={name} onChange={setName} />
        <Field label="Address line 1" required value={address1} onChange={setAddress1} />
        <Field label="Address line 2" value={address2} onChange={setAddress2} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" required value={city} onChange={setCity} />
          <Field label="Postcode" required value={postal} onChange={setPostal} />
        </div>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Country
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body"
          >
            <option value="GB">United Kingdom</option>
            <option value="IE">Ireland</option>
            <option value="FR">France</option>
            <option value="DE">Germany</option>
            <option value="ES">Spain</option>
            <option value="NL">Netherlands</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="OTHER">Other (entered with Stripe)</option>
          </select>
        </label>
        {err && <p className="font-mono text-caption text-accent-sun">{err}</p>}
      </div>

      <aside className="h-fit rounded-sm border border-ink/10 bg-surface-2 p-6">
        <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">Summary</h2>
        <ul className="mt-4 space-y-3 border-b border-ink/10 pb-4">
          {items.map((i) => (
            <li
              key={i.variantId}
              className="flex justify-between gap-3 font-body text-caption text-ink"
            >
              <span>
                {i.title}
                {i.variantTitle ? (
                  <span className="text-ink/50"> · {i.variantTitle}</span>
                ) : null} × {i.quantity}
              </span>
              <span className="shrink-0 font-mono">
                {formatPrice(i.price * i.quantity, i.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between font-body text-body text-ink">
          <span>Subtotal</span>
          <span className="font-mono">{formatPrice(subtotal, items[0]?.currency ?? "GBP")}</span>
        </div>
        <p className="mt-1 font-mono text-caption text-ink/50">
          Shipping shown on the Stripe page.
        </p>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <span className="font-mono text-caption tracking-wide text-ink/50 uppercase">
            Discount code
          </span>
          <div className="mt-2 flex gap-2">
            <input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoInfo(null);
              }}
              placeholder="e.g. STUDENT5"
              className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption uppercase"
            />
            <button
              type="button"
              onClick={applyPromo}
              disabled={promoPending || !promoCode.trim()}
              className="shrink-0 rounded-sm border border-ink/30 px-3 py-2 font-mono text-caption uppercase transition-colors hover:border-ink/60 disabled:opacity-50"
            >
              {promoPending ? "…" : "Apply"}
            </button>
          </div>
          {promoInfo && (
            <p
              className={`mt-2 font-mono text-caption ${
                promoInfo.valid ? "text-accent-sea" : "text-accent-sun"
              }`}
            >
              {promoInfo.message}
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <span className="font-mono text-caption tracking-wide text-ink/50 uppercase">
            Gift card
          </span>
          <div className="mt-2 flex gap-2">
            <input
              value={gcCode}
              onChange={(e) => {
                setGcCode(e.target.value);
                setGcInfo(null);
              }}
              placeholder="NN-XXXX-XXXX-XXXX"
              className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption uppercase"
            />
            <button
              type="button"
              onClick={applyGiftCard}
              disabled={gcPending || !gcCode.trim()}
              className="shrink-0 rounded-sm border border-ink/30 px-3 py-2 font-mono text-caption uppercase transition-colors hover:border-ink/60 disabled:opacity-50"
            >
              {gcPending ? "…" : "Apply"}
            </button>
          </div>
          {gcInfo && (
            <p
              className={`mt-2 font-mono text-caption ${
                gcInfo.valid ? "text-accent-sea" : "text-accent-sun"
              }`}
            >
              {gcInfo.valid && gcInfo.balance != null
                ? `Gift card applied — ${formatPrice(gcInfo.balance, gcInfo.currency)} available. Any remainder goes on the Stripe page.`
                : gcInfo.message}
            </p>
          )}
        </div>

        {credit.balance > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="mt-0.5 accent-accent-sun"
              />
              <span className="font-mono text-caption text-ink/70">
                Apply your store credit —{" "}
                <span className="text-ink">{formatPrice(credit.balance, credit.currency)}</span>{" "}
                available. Used before card payment; any remainder goes on the Stripe page.
              </span>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-sm bg-accent-sun py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Redirecting…" : "Continue to payment"}
        </button>
        <p className="mt-3 font-mono text-caption text-ink/40">
          Payment handled by Stripe. We never see your card.
        </p>
        <div className="mt-5 border-t border-ink/10 pt-5">
          <TrustBadges />
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-3 font-body text-body"
      />
    </label>
  );
}
