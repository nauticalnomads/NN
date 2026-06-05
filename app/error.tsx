"use client";

import Link from "next/link";

// Route-segment error boundary. Catches server/client render errors in a page
// and offers a retry instead of the raw "Application error" message. Most errors
// here are transient (a momentary upstream/DB blip or a deploy regeneration).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        A temporary error occurred while loading this page. Please try again.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-caption text-ink/40">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-sm bg-terracotta-text px-6 py-3 font-body text-[14px] font-medium text-hull-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-sm border border-ink/20 px-6 py-3 font-body text-[14px] text-ink no-underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
