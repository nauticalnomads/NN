"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

// Admin image slot with client-side auto-crop (no server image libs — runs on
// Cloudflare Workers). On selection the chosen file is cover-cropped + centred
// to the slot's desired dimensions and re-encoded as WebP, then swapped into the
// upload input so the unchanged server action stores a correctly-sized image.
// Upload any size/aspect; it's normalised to fit the layout.

// Parse the human "recommended" hint into target pixels.
//   "1200×900px" → 1200×900   |   "16:9" → 1280×720 (ratio, capped to 1280)
function parseTarget(rec?: string): { w: number; h: number } {
  if (rec) {
    const px = rec.match(/(\d+)\s*[×xX]\s*(\d+)/);
    if (px) return { w: Number(px[1]), h: Number(px[2]) };
    const ratio = rec.match(/(\d+)\s*:\s*(\d+)/);
    if (ratio) {
      const rw = Number(ratio[1]);
      const rh = Number(ratio[2]);
      const base = 1280;
      return rw >= rh
        ? { w: base, h: Math.round((base * rh) / rw) }
        : { w: Math.round((base * rw) / rh), h: base };
    }
  }
  return { w: 1600, h: 1600 };
}

// Cover-crop (centred) to exact target dims and re-encode as WebP.
async function cropToCover(file: File, tw: number, th: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.max(tw / bitmap.width, th / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("no 2d context");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("encode failed");
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

export function ImageSlot({
  name,
  label,
  current,
  rec,
}: {
  name: string;
  label: string;
  current?: string;
  rec?: string;
}) {
  // When `name` is empty (mega-menu single-image forms) the inputs are just
  // `file`/`alt`; otherwise they're `<name>_file` / `<name>_alt`.
  const fileName = name ? `${name}_file` : "file";
  const altName = name ? `${name}_alt` : "alt";
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const target = parseTarget(rec);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const cropped = await cropToCover(file, target.w, target.h);
      // Replace the raw selection with the cropped file so the form submits it.
      // Assigning `.files` programmatically does not re-fire `change`.
      const dt = new DataTransfer();
      dt.items.add(cropped);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(cropped);
      });
    } catch {
      // Unsupported format (e.g. SVG) — keep the original selection untouched.
      setError(true);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } finally {
      setBusy(false);
    }
  }

  const thumb = preview ?? current;
  return (
    <div className="rounded-sm border border-ink/10 p-3">
      <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</p>
      <div className="mt-2 flex gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-sm bg-driftwood">
          {thumb && (
            <Image
              src={thumb}
              alt=""
              fill
              unoptimized
              className="object-cover"
              key={thumb /* force refresh on new preview */}
            />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-deep-ink/40">
              <span className="font-mono text-[10px] tracking-widest text-hull-white uppercase">
                Cropping…
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            name={fileName}
            accept="image/*"
            onChange={onChange}
            className="block w-full font-body text-caption text-ink/70 file:mr-3 file:rounded-sm file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-xs file:tracking-widest file:text-surface file:uppercase"
          />
          <p className="font-mono text-[11px] text-ink/40">
            {error
              ? "Kept original (couldn’t auto-crop this format)"
              : `Auto-crops to ${target.w}×${target.h}px — upload any size`}
          </p>
          <input
            type="text"
            name={altName}
            placeholder="Alt text (required)"
            className="block w-full rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-body text-caption"
          />
        </div>
      </div>
    </div>
  );
}
