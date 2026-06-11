import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/Container";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Journal — Coastal Living & Style Notes",
  description:
    "Slow notes from the coast — stories on coastal living, slow style and life by the water from Nautical Nomads.",
  path: "/journal",
});
export const revalidate = 300;

export default async function Journal() {
  let posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string | null;
  }> = [];
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    posts = (data as unknown as typeof posts) ?? [];
  } catch {
    /* empty */
  }

  return (
    <Container className="py-16">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Journal</h1>
      <p className="mt-3 max-w-md font-body text-body text-ink/60">Slow notes from the coast.</p>
      <ul className="mt-10 space-y-8">
        {posts.map((p) => (
          <li key={p.id} className="border-t border-ink/10 pt-6">
            <Link href={`/journal/${p.slug}`} className="block no-underline">
              {p.cover_image_url && (
                <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden rounded-sm bg-driftwood">
                  <Image
                    src={p.cover_image_url}
                    alt={p.title}
                    fill
                    sizes="(min-width:768px) 42rem, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <h2 className="font-display text-heading text-ink hover:text-accent-sun">
                {p.title}
              </h2>
              {p.excerpt && <p className="mt-2 font-body text-body text-ink/70">{p.excerpt}</p>}
              {p.published_at && (
                <p className="mt-2 font-mono text-caption tracking-wide text-ink/40 uppercase">
                  {new Date(p.published_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          </li>
        ))}
        {posts.length === 0 && (
          <p className="font-body text-body text-ink/50">
            No posts yet. The first one&apos;s coming.
          </p>
        )}
      </ul>
    </Container>
  );
}
