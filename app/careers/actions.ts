"use server";

import { sendCareersApplication } from "@/lib/email";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per file
const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "txt", "rtf", "odt"]);

function fileExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

async function toAttachment(
  file: File | null,
  label: string,
): Promise<{ filename: string; content: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) return { error: `${label} is too large (max 5MB).` };
  const ext = fileExt(file.name);
  if (!ALLOWED_EXT.has(ext)) {
    return { error: `${label} must be a PDF or document (pdf, doc, docx, txt, rtf, odt).` };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const safeName = file.name.replace(/[^\w.\- ]/g, "_").slice(0, 80);
  return { filename: `${label}-${safeName}`, content: btoa(binary) };
}

export async function submitApplication(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const cv = formData.get("cv") as File | null;
  const cover = formData.get("cover") as File | null;

  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "Add your name and a valid email address." };
  }
  if (!message && (!cv || cv.size === 0)) {
    return { ok: false, message: "Tell us a little about yourself, or attach a CV." };
  }

  const attachments: { filename: string; content: string }[] = [];
  for (const [file, label] of [
    [cv, "CV"],
    [cover, "Cover-letter"],
  ] as const) {
    const a = await toAttachment(file, label);
    if (a && "error" in a) return { ok: false, message: a.error };
    if (a) attachments.push(a);
  }

  const sent = await sendCareersApplication({ name, email, message, attachments }).catch((e) => {
    console.error("careers application send failed:", e);
    return false;
  });
  if (!sent) {
    return {
      ok: false,
      message:
        "We couldn't submit your application just now — please email it to info@nauticalnomads.com instead.",
    };
  }
  return {
    ok: true,
    message: "Application received — we'll be in touch. Thanks for reaching out.",
  };
}
