import type { ReactNode } from "react";

// Minimal, dependency-free, XSS-safe markdown renderer. Renders to React
// elements (never dangerouslySetInnerHTML), so any HTML in the source is shown
// as text, not executed. Covers the subset our blog drafts use: headings,
// paragraphs, unordered/ordered lists, bold, italic, inline code, links.
// Not a full CommonMark implementation — no tables, images, or nested lists.

// Inline: split a line into React nodes handling **bold**, *italic*, `code`,
// and [text](url). Links are restricted to http(s)/mailto to avoid javascript:.
function inline(text: string, keyBase: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] !== undefined) {
      tokens.push(<strong key={key}>{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      tokens.push(<em key={key}>{m[4]}</em>);
    } else if (m[6] !== undefined) {
      tokens.push(
        <code key={key} className="font-mono text-[0.9em]">
          {m[6]}
        </code>,
      );
    } else if (m[8] !== undefined && m[9] !== undefined) {
      const href = m[9];
      const safe = /^(https?:|mailto:)/i.test(href);
      tokens.push(
        safe ? (
          <a key={key} href={href} className="text-accent-sun underline-offset-2 hover:underline">
            {m[8]}
          </a>
        ) : (
          <span key={key}>{m[8]}</span>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

export function renderMarkdown(md: string): ReactNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(" ");
      blocks.push(
        <p key={`p${key++}`} className="leading-relaxed">
          {inline(text, `p${key}`)}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, idx) => <li key={idx}>{inline(it, `l${key}-${idx}`)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={`o${key++}`} className="list-decimal space-y-1 pl-6">
            {items}
          </ol>
        ) : (
          <ul key={`u${key++}`} className="list-disc space-y-1 pl-6">
            {items}
          </ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const ulItem = /^[-*]\s+(.*)$/.exec(line);
    const olItem = /^\d+\.\s+(.*)$/.exec(line);

    if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const cls =
        level === 1
          ? "font-display text-heading text-ink mt-8"
          : level === 2
            ? "font-display text-sub text-ink mt-6"
            : "font-display text-body font-semibold text-ink mt-4";
      const content = inline(heading[2], `h${key}`);
      blocks.push(
        level === 1 ? (
          <h2 key={`h${key++}`} className={cls}>
            {content}
          </h2>
        ) : level === 2 ? (
          <h3 key={`h${key++}`} className={cls}>
            {content}
          </h3>
        ) : (
          <h4 key={`h${key++}`} className={cls}>
            {content}
          </h4>
        ),
      );
    } else if (ulItem) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ulItem[1]);
    } else if (olItem) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(olItem[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-5">{blocks}</div>;
}
