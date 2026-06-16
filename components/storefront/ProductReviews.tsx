"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Review, ReviewSummary } from "@/lib/reviews";
import { submitReviewAction, reviewAuthState } from "@/app/products/[slug]/review-actions";

// Small star row. `value` may be fractional (summary average); each star fills
// proportionally via an overlaid clipped layer.
function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ gap: 2 }} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="text-ink/20" />
            <span
              className="absolute top-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%`, height: size }}
            >
              <Star size={size} className="text-accent-sun" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Star({ size, className }: { size: number; className: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M12 2l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.98 6.1 20.15l1.13-6.57L2.45 8.94l6.6-.96L12 2z" />
    </svg>
  );
}

export function ProductReviews({
  productId,
  slug,
  reviews,
  summary,
}: {
  productId: string;
  slug: string;
  reviews: Review[];
  summary: ReviewSummary;
}) {
  const [showForm, setShowForm] = useState(false);
  // Eligibility is fetched client-side so the PDP stays statically rendered.
  const [auth, setAuth] = useState<{
    signedIn: boolean;
    canReview: boolean;
    defaultName: string;
  } | null>(null);

  useEffect(() => {
    reviewAuthState(productId)
      .then(setAuth)
      .catch(() => setAuth({ signedIn: false, canReview: false, defaultName: "" }));
  }, [productId]);

  const signedIn = auth?.signedIn ?? false;
  const canReview = auth?.canReview ?? false;
  const defaultName = auth?.defaultName ?? "";

  return (
    <section className="mt-24 border-t border-ink/10 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-heading tracking-tight text-ink">Reviews</h2>
          {summary.count > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <Stars value={summary.average} />
              <span className="font-mono text-caption text-ink/60">
                {summary.average.toFixed(1)} · {summary.count} review
                {summary.count === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <p className="mt-2 font-body text-body text-ink/50">
              No reviews yet — be the first to share yours.
            </p>
          )}
        </div>

        {auth === null ? null : canReview ? (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-sm border border-ink/30 px-4 py-2 font-mono text-caption tracking-widest text-ink uppercase transition-colors hover:border-ink/60"
          >
            {showForm ? "Close" : "Write a review"}
          </button>
        ) : signedIn ? (
          <p className="max-w-[16rem] text-right font-mono text-caption text-ink/45">
            Only verified buyers can review this product.
          </p>
        ) : (
          <Link
            href={`/account/login?next=/products/${slug}`}
            className="rounded-sm border border-ink/30 px-4 py-2 font-mono text-caption tracking-widest text-ink uppercase no-underline transition-colors hover:border-ink/60"
          >
            Sign in to review
          </Link>
        )}
      </div>

      {canReview && showForm && (
        <ReviewForm
          productId={productId}
          slug={slug}
          defaultName={defaultName}
          onDone={() => setShowForm(false)}
        />
      )}

      {reviews.length > 0 && (
        <ul className="mt-10 divide-y divide-ink/10">
          {reviews.map((r) => (
            <li key={r.id} className="py-6">
              <div className="flex items-center gap-3">
                <Stars value={r.rating} size={14} />
                {r.verified_purchase && (
                  <span className="rounded-sm bg-accent-sea/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-accent-sea uppercase">
                    Verified purchase
                  </span>
                )}
              </div>
              {r.title && (
                <p className="mt-2 font-body text-body font-medium text-ink">{r.title}</p>
              )}
              <p className="mt-1 font-body text-body leading-relaxed text-ink/80">{r.body}</p>
              <p className="mt-2 font-mono text-caption text-ink/45">
                {r.author_name} ·{" "}
                {new Date(r.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewForm({
  productId,
  slug,
  defaultName,
  onDone,
}: {
  productId: string;
  slug: string;
  defaultName: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const res = await submitReviewAction({
        productId,
        slug,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        authorName: name.trim() || undefined,
      });
      setResult(res);
      if (res.ok) {
        setTitle("");
        setBody("");
        setTimeout(onDone, 2500);
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 max-w-xl rounded-sm border border-ink/10 bg-surface-2 p-6"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Rating</span>
        <span className="inline-flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="p-0.5"
            >
              <Star
                size={22}
                className={(hover || rating) >= n ? "text-accent-sun" : "text-ink/20"}
              />
            </button>
          ))}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Display name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>

      <label className="mt-4 block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Title (optional)
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>

      <label className="mt-4 block">
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Your review
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
      </label>

      {result && (
        <p
          className={`mt-3 font-mono text-caption ${result.ok ? "text-accent-sea" : "text-accent-sun"}`}
        >
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
