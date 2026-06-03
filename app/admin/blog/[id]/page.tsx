import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ImageSlot } from "../../content/ImageSlot";
import { saveBlogPost } from "../actions";

type Post = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  status: string;
  source_url: string | null;
};

const input =
  "mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body";
const labelCls = "font-mono text-caption tracking-wide text-ink/60 uppercase";

export default async function BlogEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sb = createServiceClient();
  const { data } = await sb.from("blog_posts").select("*").eq("id", id).maybeSingle();
  const p = data as unknown as Post | null;
  if (!p) notFound();

  // Collection link options for the "Related link" field.
  const { data: cols } = await sb
    .from("collections")
    .select("slug, title, parent_slug")
    .eq("status", "published")
    .order("title");
  const collections =
    (cols as unknown as { slug: string; title: string; parent_slug: string | null }[]) ?? [];
  const titleBySlug = Object.fromEntries(collections.map((c) => [c.slug, c.title]));
  const linkOptions = collections.map((c) => ({
    value: `/collections/${c.slug}`,
    label: c.parent_slug ? `${titleBySlug[c.parent_slug] ?? c.parent_slug} › ${c.title}` : c.title,
  }));
  const known = new Set(["", "/shop", ...linkOptions.map((o) => o.value)]);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/blog"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Blog
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">Edit post</h1>
      <p className="mt-2 font-body text-caption text-ink/50">
        /journal/{p.slug}
        {p.source_url && (
          <>
            {" · "}
            <a href={p.source_url} target="_blank" rel="noreferrer" className="hover:underline">
              source
            </a>
          </>
        )}
      </p>

      <form action={saveBlogPost} className="mt-8 space-y-5">
        <input type="hidden" name="id" value={p.id} />

        <ImageSlot
          name="cover"
          label="Cover image"
          current={p.cover_image_url ?? undefined}
          rec="1600×900px"
        />
        {p.cover_image_url && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="cover_remove" className="h-4 w-4 accent-accent-sun" />
            <span className="font-body text-caption text-ink/60">Remove current cover</span>
          </label>
        )}

        <label className="block">
          <span className={labelCls}>Title</span>
          <input name="title" defaultValue={p.title} className={input} />
        </label>

        <label className="block">
          <span className={labelCls}>Body (Markdown)</span>
          <textarea
            name="body"
            defaultValue={p.body ?? ""}
            rows={18}
            className={`${input} font-mono text-caption`}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Excerpt</span>
          <textarea name="excerpt" defaultValue={p.excerpt ?? ""} rows={2} className={input} />
        </label>

        <label className="block">
          <span className={labelCls}>Related link / collection</span>
          <select name="source_url" defaultValue={p.source_url ?? ""} className={input}>
            <option value="">— None —</option>
            <option value="/shop">All products (/shop)</option>
            {p.source_url && !known.has(p.source_url) && (
              <option value={p.source_url}>{p.source_url} (current)</option>
            )}
            {linkOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-body text-[11px] text-ink/40">
            Shown as a “Shop the collection” button on the post when it points to a collection.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>SEO title</span>
            <input name="seo_title" defaultValue={p.seo_title ?? ""} className={input} />
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select name="status" defaultValue={p.status} className={input}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>SEO description</span>
          <textarea
            name="seo_description"
            defaultValue={p.seo_description ?? ""}
            rows={2}
            className={input}
          />
        </label>

        <button className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
          Save post
        </button>
      </form>
    </div>
  );
}
