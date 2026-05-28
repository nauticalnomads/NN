// Renders a JSON-LD <script>. Server-rendered so crawlers see it in the HTML.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is trusted, app-generated content.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
