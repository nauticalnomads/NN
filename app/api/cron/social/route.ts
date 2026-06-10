import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { dispatchSocialPost } from "@/lib/social";
import { tokenAuthorized } from "@/lib/webhook-auth";

// Scheduled-post dispatcher. Driven by the same Cloudflare Cron Trigger as the
// abandoned-cart job (hourly; see worker.js + wrangler.jsonc). Finds social
// drafts queued with status 'scheduled' whose scheduled_at has passed and
// publishes each via the Make.com webhook (lib/social → dispatchSocialPost,
// which flips status to posted/failed). Idempotent: dispatch CAS-guards on
// status, so a re-run or overlap can't double-post.
//
// Manual trigger: POST /api/cron/social with header X-NN-Cron-Secret = CRON_SECRET.
export async function POST(request: NextRequest) {
  // Fail closed: an unset CRON_SECRET rejects everything (set it in Cloudflare).
  const expected = process.env.CRON_SECRET;
  if (!tokenAuthorized(expected, request.headers.get("x-nn-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await sb
    .from("social_drafts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(50);
  const due = (data as unknown as Array<{ id: string }>) ?? [];

  let posted = 0;
  for (const d of due) {
    const ok = await dispatchSocialPost(d.id);
    if (ok) posted += 1;
  }

  return NextResponse.json({ due: due.length, posted });
}
