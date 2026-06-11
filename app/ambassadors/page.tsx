import Image from "next/image";
import { Container } from "@/components/Container";
import { getCmsValue } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ambassadors",
  description:
    "Meet the Nautical Nomads ambassadors — the people who wear our coastal clothing where the water meets the land. Join the crew.",
  path: "/ambassadors",
});

type Ambassador = { name?: string; role?: string; image?: string; social?: string };

export default async function Ambassadors() {
  const data = await getCmsValue<{ people: Ambassador[] }>("ambassadors");
  const people = Array.isArray(data?.people) ? data.people : [];

  return (
    <Container className="py-16">
      <h1 className="font-display text-display-2 font-semibold tracking-tight text-deep-ink">
        Ambassadors
      </h1>
      <p className="mt-3 max-w-xl font-body text-body text-ink/70">
        The people who wear it where the water meets the land.
      </p>

      {people.length === 0 ? (
        <p className="mt-10 font-body text-body text-ink/50">
          Our ambassador roster is coming soon.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((p, i) => (
            <div key={i}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-driftwood">
                {p.image && (
                  <Image src={p.image} alt={p.name ?? ""} fill className="object-cover" />
                )}
              </div>
              <p className="mt-3 font-body text-[15px] font-semibold text-deep-ink">{p.name}</p>
              {p.role && <p className="font-body text-caption text-meta">{p.role}</p>}
              {p.social && (
                <a
                  href={p.social}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-body text-caption text-terracotta-text no-underline hover:underline"
                >
                  Follow →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
