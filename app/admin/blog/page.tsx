import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { draftFromUrlAction, publishDraft, discardDraft } from "./actions";

export default async function AdminBlog() {
  await requireStaff();
  const sb = createServiceClient();
  const { data } = await sb
    .from("blog_posts")
    .select("id, title, slug, status, trigger, created_at")
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

      <form action={draftFromUrlAction} className="mt-8 flex gap-3 border-y border-ink/10 py-5">
        <input
          name="url"
          required
          type="url"
          placeholder="https://example.com/article"
          className="flex-1 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
        <button className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase">
          Draft from URL
        </button>
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
            <div>
              <p className="font-body text-body text-ink">{d.title}</p>
              <p className="font-mono text-caption text-ink/50">
                {d.trigger ?? "manual"} · {new Date(d.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-3">
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
          <li key={p.id} className="rounded-sm border border-ink/10 p-4">
            <p className="font-body text-body text-ink">{p.title}</p>
            <p className="font-mono text-caption text-ink/50">
              {p.status} · /journal/{p.slug}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
