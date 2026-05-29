"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// While the order isn't yet `paid`, the Stripe webhook may still be in flight
// (we trust the webhook, not the redirect). Poll by re-running the server
// component via router.refresh() every few seconds until it flips, then stop.
// Bounded so we never poll forever on a genuinely failed payment.
export function StatusPoll({ paid }: { paid: boolean }) {
  const router = useRouter();
  const tries = useRef(0);

  useEffect(() => {
    if (paid) return; // already confirmed — nothing to poll
    const id = setInterval(() => {
      tries.current += 1;
      if (tries.current > 20) {
        clearInterval(id); // ~1 min of polling, then give up quietly
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [paid, router]);

  return null;
}
