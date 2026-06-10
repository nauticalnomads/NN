"use client";

import { useState } from "react";

// Read-only referral link with a copy button. Kept tiny + client-only so the
// account page stays a server component.
export function ReferralLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  return (
    <div className="mt-3 flex max-w-xl gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-sm border border-ink/30 px-4 py-2 font-mono text-caption uppercase transition-colors hover:border-ink/60"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
