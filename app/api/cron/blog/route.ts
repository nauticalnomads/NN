import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenAuthorized } from "@/lib/webhook-auth";

// Scheduled blog publisher. Driven by the same hourly Cloudflare Cron Trigger
// as the other jobs (worker.js + wrangler.jsonc): publishes blog_posts in
// status 'scheduled' whose scheduled_at has passed, stamping published_at the
// first time. Idempotent — the status filter means a re-run finds nothing due.
//
// Manual trigger: POST /api/cron/blog with header X-NN-Cron-Secret = CRON_SECRET.
export async function POST(request: NextRequest) {
  // Fail closed: an unset CRON_SECRET rejects everything (set it in Cloudflare).
  const expected = process.env.CRON_SECRET;
  if (!tokenAuthorized(expected, request.headers.get("x-nn-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await sb
    .from("blog_posts")
    .select("id, slug, published_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(20);
  const due =
    (data as unknown as { id: string; slug: string; published_at: string | null }[]) ?? [];

  let published = 0;
  for (const post of due) {
    const { error } = await sb
      .from("blog_posts")
      .update({
        status: "published",
        published_at: post.published_at ?? now,
      } as never)
      .eq("id", post.id)
      .eq("status", "scheduled");
    if (!error) {
      published += 1;
      revalidatePath(`/journal/${post.slug}`);
    }
  }
  if (published > 0) revalidatePath("/journal");

  return NextResponse.json({ due: due.length, published });
}
