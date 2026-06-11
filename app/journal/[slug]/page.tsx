import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/seo/JsonLd";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { articleLd, breadcrumbLd } from "@/lib/structured-data";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 300;

type Post = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  source_url: string | null;
  published_at: string | null;
};

async function getPost(slug: string): Promise<Post | null> {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("blog_posts")
      .select(
        "id, title, slug, body, seo_title, seo_description, cover_image_url, source_url, published_at",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return (data as unknown as Post) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) return { title: "Not found" };
  return pageMetadata({
    title: p.seo_title || p.title,
    description: p.seo_description || `${p.title} — slow notes from the coast by Nautical Nomads.`,
    path: `/journal/${p.slug}`,
    image: p.cover_image_url || undefined,
  });
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) notFound();
  return (
    <Container className="py-16">
      <JsonLd data={articleLd(p)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Journal", path: "/journal" },
          { name: p.title, path: `/journal/${p.slug}` },
        ])}
      />
      <article className="max-w-2xl">
        {p.cover_image_url && (
          <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-sm bg-driftwood">
            <Image
              src={p.cover_image_url}
              alt={p.title}
              fill
              sizes="(min-width:768px) 42rem, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}
        <h1 className="font-display text-display-2 tracking-tight text-ink">{p.title}</h1>
        {p.published_at && (
          <p className="mt-4 font-mono text-caption tracking-wide text-ink/40 uppercase">
            {new Date(p.published_at).toLocaleDateString()}
          </p>
        )}
        <div className="mt-8 font-body text-body leading-relaxed text-ink/85">
          {renderMarkdown(p.body ?? "")}
        </div>
        {p.source_url && p.source_url.startsWith("/") && (
          <a
            href={p.source_url}
            className="mt-8 inline-flex items-center rounded-sm bg-terracotta-text px-6 py-3 font-body text-[14px] font-medium text-hull-white no-underline transition-opacity hover:opacity-90"
          >
            Shop the collection →
          </a>
        )}
      </article>
    </Container>
  );
}
