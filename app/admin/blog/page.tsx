import Link from "next/link";
import Image from "next/image";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { draftFromUrlAction, publishDraft, discardDraft } from "./actions";

const STATUS_MSG: Record<string, { text: string; tone: "ok" | "warn" }> = {
  saved: { text: "Post saved.", tone: "ok" },
  ai: { text: "Draft written from the URL with AI. Review it below, then Publish.", tone: "ok" },
  scraped: {
    text: "Draft created from the page's text (AI key not set — set ANTHROPIC_API_KEY on the worker for finished copy). Edit it below.",
    tone: "warn",
  },
  fetch_failed: {
    text: "Couldn't read that URL (it may block bots). A draft stub was created — write or fix the link.",
    tone: "warn",
  },
  insert_failed: {
    text: "Draft could not be saved. If this persists, run `notify pgrst, 'reload schema';` in Supabase.",
    tone: "warn",
  },
};

export default async function AdminBlog({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff();
  const { status } = await searchParams;
  const banner = status ? STATUS_MSG[status] : undefined;
  const sb = createServiceClient();
  const { data } = await sb
    .from("blog_posts")
    .select("id, title, slug, status, trigger, created_at, excerpt, cover_image_url, source_url")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows =
    (data as unknown as Array<{
      id: string;
      title: string;
      slug: string;
      status: string;
      trigger: string | null;
      created_at: string;
      excerpt: string | null;
      cover_image_url: string | null;
      source_url: string | null;
    }>) || [];
  const drafts = rows.filter((r) => r.status === "draft");
  const others = rows.filter((r) => r.status !== "draft");

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Blog</h1>
      <p className="mt-3 max-w-xl font-body text-body text-ink/60">
        Drafts auto-queue when products are published or go on sale. You can also paste a URL to
        draft from.
      </p>

      {banner && (
        <div
          className={`mt-6 rounded-sm border px-4 py-3 font-body text-caption ${
            banner.tone === "ok"
              ? "border-accent-sea/30 bg-accent-sea/5 text-ink"
              : "border-accent-sun/40 bg-accent-sun/5 text-ink"
          }`}
        >
          {banner.text}
        </div>
      )}

      <form action={draftFromUrlAction} className="mt-8 flex gap-3 border-y border-ink/10 py-5">
        <input
          name="url"
          required
          type="url"
          placeholder="https://example.com/article"
          className="flex-1 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
        <SubmitButton
          pendingText="Drafting…"
          className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase"
        >
          Draft from URL
        </SubmitButton>
      </form>

      <h2 className="mt-10 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Drafts ({drafts.length})
      </h2>
      <ul className="mt-4 space-y-2">
        {drafts.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-sm border border-ink/10 p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                {d.cover_image_url && (
                  <Image src={d.cover_image_url} alt="" fill unoptimized className="object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-body text-body text-ink">{d.title}</p>
                {d.excerpt && (
                  <p className="mt-0.5 line-clamp-2 font-body text-caption text-ink/60">
                    {d.excerpt}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-caption text-ink/45">
                  {d.trigger ?? "manual"} · {new Date(d.created_at).toLocaleDateString()}
                  {d.source_url && <> · {d.source_url}</>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/admin/blog/${d.id}`}
                className="font-mono text-caption tracking-widest text-ink uppercase no-underline underline-offset-4 hover:underline"
              >
                Edit
              </Link>
              <form action={publishDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="font-mono text-caption tracking-widest text-accent-sea uppercase underline-offset-4 hover:underline">
                  Publish
                </button>
              </form>
              <form action={discardDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="font-mono text-caption tracking-widest text-ink/50 uppercase underline-offset-4 hover:underline">
                  Discard
                </button>
              </form>
            </div>
          </li>
        ))}
        {drafts.length === 0 && (
          <p className="font-body text-body text-ink/50">No drafts in the queue.</p>
        )}
      </ul>

      <h2 className="mt-10 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Recent posts
      </h2>
      <ul className="mt-4 space-y-2">
        {others.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-sm border border-ink/10 p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                {p.cover_image_url && (
                  <Image src={p.cover_image_url} alt="" fill unoptimized className="object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-body text-body text-ink">{p.title}</p>
                {p.excerpt && (
                  <p className="mt-0.5 line-clamp-2 font-body text-caption text-ink/60">
                    {p.excerpt}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-caption text-ink/45">
                  {p.status} · /journal/{p.slug}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/blog/${p.id}`}
              className="shrink-0 font-mono text-caption tracking-widest text-ink uppercase no-underline underline-offset-4 hover:underline"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
