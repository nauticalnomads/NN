import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/seo/JsonLd";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl, site } from "@/lib/site";

export const revalidate = 300;

type Post = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
};

async function getPost(slug: string): Promise<Post | null> {
  try {
    const sb = await createClient();
    const { data } = await sb
      .from("blog_posts")
      .select("id, title, slug, body, seo_title, seo_description, published_at")
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
  return {
    title: p.seo_title || p.title,
    description: p.seo_description ?? undefined,
    alternates: { canonical: absoluteUrl(`/journal/${p.slug}`) },
  };
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) notFound();
  return (
    <Container className="py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: p.title,
          url: absoluteUrl(`/journal/${p.slug}`),
          datePublished: p.published_at,
          author: { "@type": "Organization", name: site.name },
        }}
      />
      <article className="max-w-2xl">
        <h1 className="font-display text-display-2 tracking-tight text-ink">{p.title}</h1>
        {p.published_at && (
          <p className="mt-4 font-mono text-caption tracking-wide text-ink/40 uppercase">
            {new Date(p.published_at).toLocaleDateString()}
          </p>
        )}
        <div className="mt-8 whitespace-pre-line font-body text-body leading-relaxed text-ink/85">
          {p.body}
        </div>
      </article>
    </Container>
  );
}
