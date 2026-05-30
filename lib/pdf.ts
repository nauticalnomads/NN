// Minimal dependency-free single-page PDF generator. Works anywhere (just byte
// assembly) — important on Cloudflare Workers where heavy PDF libs / puppeteer
// can't run. Renders left-aligned text lines in Helvetica. Enough for a tidy
// one-page financial report; not a general-purpose PDF toolkit.

type Line = { text: string; size?: number; gap?: number };

function escapePdfText(s: string): string {
  // Escape characters special to PDF string literals; drop non-Latin1.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

export function simplePdf(lines: Line[]): Uint8Array {
  const pageHeight = 792; // US Letter points (8.5x11 @ 72dpi)
  const left = 64;
  let y = pageHeight - 80;

  // Build the content stream: a sequence of positioned text show operations.
  let content = "";
  for (const ln of lines) {
    const size = ln.size ?? 11;
    content += `BT /F1 ${size} Tf 1 0 0 1 ${left} ${y} Tm (${escapePdfText(ln.text)}) Tj ET\n`;
    y -= ln.gap ?? size + 6;
  }

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>";
  objects[4] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  // Assemble with a byte-accurate xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}
