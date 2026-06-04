"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { setCmsValue } from "@/lib/cms";
import { uploadImage } from "@/lib/storage";
import { generateAltText } from "@/lib/anthropic";

// Homepage & Content CMS actions (redesign v2 §7). Content admin may manage
// homepage content (matrix §3 puts pages/products/social under content role).
// Images are auto-cropped client-side (ImageSlot) before upload.

// Use the typed alt when provided; otherwise auto-generate one for a freshly
// uploaded image (accessibility + SEO). Falls back to "" with no AI key.
async function altFor(provided: string, url: string | null, uploaded: boolean): Promise<string> {
  if (provided.trim()) return provided.trim();
  if (uploaded && url) return (await generateAltText(url)) ?? "";
  return provided;
}

// Generic: read current value, merge an image slot + alt, save under `key`.
// `slot` is a dotted path within the value (e.g. "left", "columns.0").
async function readValue(key: string): Promise<Record<string, unknown>> {
  const sb = createServiceClient();
  const { data } = await sb.from("cms_content").select("value").eq("key", key).maybeSingle();
  return ((data as unknown as { value: Record<string, unknown> } | null)?.value ?? {}) as Record<
    string,
    unknown
  >;
}

// ── Hero (§7.1) ──────────────────────────────────────────────────────────────
export async function saveHero(formData: FormData): Promise<void> {
  await requireStaff();
  const cur = await readValue("home.hero");
  const slotImg = async (slot: string, cmsKey: string) => {
    const f = formData.get(`${slot}_file`) as File | null;
    const uploaded = !!(f && f.size);
    const url = uploaded
      ? await uploadImage(f!, cmsKey)
      : ((cur[slot] as { url?: string })?.url ?? null);
    const alt = await altFor(String(formData.get(`${slot}_alt`) || ""), url, uploaded);
    return { url: url ?? undefined, alt };
  };
  const value = {
    left: await slotImg("left", "hero-left"),
    rightTop: await slotImg("rightTop", "hero-right-top"),
    rightBottom: await slotImg("rightBottom", "hero-right-bottom"),
    line1: String(formData.get("line1") || ""),
    line2: String(formData.get("line2") || ""),
    ctaText: String(formData.get("ctaText") || ""),
    ctaUrl: String(formData.get("ctaUrl") || ""),
    ctaShow: formData.get("ctaShow") === "on",
  };
  await setCmsValue("home.hero", value);
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Editorial banner (§7.3) ──────────────────────────────────────────────────
export async function saveBanner(formData: FormData): Promise<void> {
  await requireStaff();
  const cur = (await readValue("home.banner")) as { columns?: Array<{ image?: { url?: string } }> };
  const columns = [];
  for (let i = 0; i < 3; i++) {
    const f = formData.get(`col${i}_file`) as File | null;
    const uploaded = !!(f && f.size);
    const url = uploaded
      ? await uploadImage(f!, `banner-${i}`)
      : (cur.columns?.[i]?.image?.url ?? null);
    const alt = await altFor(String(formData.get(`col${i}_alt`) || ""), url, uploaded);
    columns.push({
      image: { url: url ?? undefined, alt },
      overlay: formData.get(`col${i}_overlay`) === "on",
      heading: String(formData.get(`col${i}_heading`) || ""),
      url: String(formData.get(`col${i}_url`) || ""),
    });
  }
  await setCmsValue("home.banner", { columns });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Campaign title (§7.4) ────────────────────────────────────────────────────
export async function saveCampaign(formData: FormData): Promise<void> {
  await requireStaff();
  await setCmsValue("home.campaign", {
    heading: String(formData.get("heading") || ""),
    ctaText: String(formData.get("ctaText") || ""),
    ctaUrl: String(formData.get("ctaUrl") || ""),
  });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Photo strip (§7.5) ───────────────────────────────────────────────────────
export async function saveStrip(formData: FormData): Promise<void> {
  await requireStaff();
  const cur = (await readValue("home.strip")) as { images?: Array<{ url?: string }> };
  const images = [];
  for (let i = 0; i < 3; i++) {
    const f = formData.get(`img${i}_file`) as File | null;
    const uploaded = !!(f && f.size);
    const url = uploaded ? await uploadImage(f!, `strip-${i}`) : (cur.images?.[i]?.url ?? null);
    const alt = await altFor(String(formData.get(`img${i}_alt`) || ""), url, uploaded);
    images.push({ url: url ?? undefined, alt });
  }
  await setCmsValue("home.strip", { images });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Category tiles (§7.6) ────────────────────────────────────────────────────
export async function saveTiles(formData: FormData): Promise<void> {
  await requireStaff();
  const cur = (await readValue("home.tiles")) as { tiles?: Array<{ image?: { url?: string } }> };
  const tiles = [];
  for (let i = 0; i < 8; i++) {
    const f = formData.get(`tile${i}_file`) as File | null;
    const uploaded = !!(f && f.size);
    const url = uploaded
      ? await uploadImage(f!, `tile-${i}`)
      : (cur.tiles?.[i]?.image?.url ?? null);
    const alt = await altFor(String(formData.get(`tile${i}_alt`) || ""), url, uploaded);
    tiles.push({
      image: { url: url ?? undefined, alt },
      label: String(formData.get(`tile${i}_label`) || ""),
      url: String(formData.get(`tile${i}_url`) || ""),
      row: (formData.get(`tile${i}_row`) === "men" ? "men" : "women") as "men" | "women",
    });
  }
  await setCmsValue("home.tiles", { tiles });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Carousel settings (§7.2) ─────────────────────────────────────────────────
export async function saveCarousel(formData: FormData): Promise<void> {
  await requireStaff();
  await setCmsValue("home.carousel1", {
    heading: String(formData.get("heading") || ""),
    collection: String(formData.get("collection") || ""),
    show: formData.get("show") === "on",
  });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Mega-menu images (§7.7) ──────────────────────────────────────────────────
export async function saveMegaImage(formData: FormData): Promise<void> {
  await requireStaff();
  const key = String(formData.get("image_key") || "");
  if (!key) return;
  const f = formData.get("file") as File | null;
  if (!f || !f.size) return;
  const url = await uploadImage(f, `mega/${key}`);
  if (url) await setCmsValue(key, { url, alt: String(formData.get("alt") || "") });
  revalidatePath("/admin/content");
}

// ── Footer tags (§7.8) ───────────────────────────────────────────────────────
export async function saveFooterTags(formData: FormData): Promise<void> {
  await requireStaff();
  // tags submitted as JSON [{label,href}] from the client editor.
  let tags: Array<{ label: string; href: string }> = [];
  try {
    const raw = JSON.parse(String(formData.get("tags") || "[]"));
    if (Array.isArray(raw)) {
      tags = raw
        .map((t) => ({ label: String(t.label || "").trim(), href: String(t.href || "").trim() }))
        .filter((t) => t.label && t.href)
        .slice(0, 20);
    }
  } catch {
    return;
  }
  await setCmsValue("footer.tags", { tags });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

// ── Newsletter settings (§7.9) ───────────────────────────────────────────────
export async function saveNewsletterSettings(formData: FormData): Promise<void> {
  await requireStaff();
  await setCmsValue("newsletter.settings", {
    code: String(formData.get("code") || "WELCOME10").trim(),
  });
  revalidatePath("/admin/content");
}
