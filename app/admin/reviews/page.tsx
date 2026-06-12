import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { adminListReviews, type AdminReview } from "@/lib/reviews";
import { moderateReview } from "./actions";

export const metadata = { title: "Reviews", robots: { index: false, follow: false } };

export default async function AdminReviewsPage() {
  await requireStaff();
  const reviews = await adminListReviews();
  const pending = reviews.filter((r) => r.status === "pending");
  const published = reviews.filter((r) => r.status === "published");
  const rejected = reviews.filter((r) => r.status === "rejected");

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Reviews</h1>
      <p className="mt-3 font-body text-body text-ink/70">
        Customer reviews are held for moderation, then published to the product page.
      </p>

      <Section title={`Pending (${pending.length})`} empty="Nothing waiting for moderation.">
        {pending.map((r) => (
          <ReviewCard key={r.id} review={r} actions={["published", "rejected"]} />
        ))}
      </Section>

      <Section title={`Published (${published.length})`} empty="No published reviews yet.">
        {published.map((r) => (
          <ReviewCard key={r.id} review={r} actions={["rejected"]} />
        ))}
      </Section>

      {rejected.length > 0 && (
        <Section title={`Rejected (${rejected.length})`} empty="">
          {rejected.map((r) => (
            <ReviewCard key={r.id} review={r} actions={["published"]} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <section className="mt-10">
      <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">{title}</h2>
      {isEmpty ? (
        empty ? (
          <p className="mt-3 font-body text-body text-ink/40">{empty}</p>
        ) : null
      ) : (
        <ul className="mt-4 space-y-3">{children}</ul>
      )}
    </section>
  );
}

const STARS = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

const ACTION_LABEL: Record<string, string> = {
  published: "Approve",
  rejected: "Reject",
  pending: "Unpublish",
};

function ReviewCard({
  review,
  actions,
}: {
  review: AdminReview;
  actions: ("published" | "rejected" | "pending")[];
}) {
  return (
    <li className="rounded-sm border border-ink/10 bg-surface-2 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-body text-accent-sun">{STARS(review.rating)}</span>
        {review.verified_purchase && (
          <span className="rounded-sm bg-accent-sea/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-accent-sea uppercase">
            Verified
          </span>
        )}
        {review.product_slug ? (
          <Link
            href={`/products/${review.product_slug}`}
            className="font-mono text-caption text-ink/60 hover:text-accent-sun"
          >
            {review.product_title}
          </Link>
        ) : (
          <span className="font-mono text-caption text-ink/40">(product removed)</span>
        )}
      </div>
      {review.title && (
        <p className="mt-2 font-body text-body font-medium text-ink">{review.title}</p>
      )}
      <p className="mt-1 font-body text-body leading-relaxed text-ink/80">{review.body}</p>
      <p className="mt-2 font-mono text-caption text-ink/45">
        {review.author_name} ·{" "}
        {new Date(review.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      <div className="mt-4 flex gap-2">
        {actions.map((status) => (
          <form key={status} action={moderateReview}>
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="slug" value={review.product_slug ?? ""} />
            <button
              type="submit"
              className={`rounded-sm px-3 py-1.5 font-mono text-caption tracking-widest uppercase ${
                status === "published"
                  ? "bg-accent-sun text-surface"
                  : "border border-ink/30 text-ink hover:border-ink/60"
              }`}
            >
              {ACTION_LABEL[status]}
            </button>
          </form>
        ))}
      </div>
    </li>
  );
}
