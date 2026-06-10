"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getTemplateDef,
  sampleVarsFor,
  renderEmail,
  getEmailBranding,
} from "@/lib/email-templates";
import { sendTemplateTest } from "@/lib/email";
import { setCmsValue } from "@/lib/cms";
import { uploadImage } from "@/lib/storage";

// Upload/replace the email logo + cover images (stored in cms-assets, URLs in
// the cms_content "email.branding" key). Uploading one keeps the other; the
// "remove" checkboxes clear them back to the text wordmark / no cover.
export async function saveEmailBranding(formData: FormData) {
  await requireOps();
  const cur = await getEmailBranding();

  // Logo (single).
  const logoFile = formData.get("logo") as File | null;
  const removeLogo = formData.get("remove_logo") === "on";
  const logo_url = removeLogo
    ? null
    : logoFile && logoFile.size > 0
      ? await uploadImage(logoFile, "email/logo")
      : cur.logo_url;

  // Covers (many, rotated). Keep existing minus any ticked for removal, then
  // append newly uploaded ones.
  const removed = new Set(formData.getAll("remove_cover").map(String));
  const cover_urls = cur.cover_urls.filter((u) => !removed.has(u));
  for (const f of formData.getAll("cover") as File[]) {
    if (f && f.size > 0) {
      const u = await uploadImage(f, "email/cover");
      if (u) cover_urls.push(u);
    }
  }

  await setCmsValue("email.branding", { logo_url, cover_urls });
  revalidatePath("/admin/emails");
  redirect("/admin/emails?status=saved");
}

// Save (upsert) an override for one template. Blank fields are stored as null so
// they transparently fall back to the code default.
export async function saveTemplate(formData: FormData) {
  await requireOps();
  const key = String(formData.get("key") || "");
  if (!getTemplateDef(key)) redirect("/admin/emails?status=error");

  const subject = String(formData.get("subject") || "").trim() || null;
  const heading = String(formData.get("heading") || "").trim() || null;
  const body = String(formData.get("body") || "").trim() || null;

  const sb = createServiceClient();
  const { error } = await sb.from("email_templates").upsert(
    {
      key,
      subject,
      heading,
      body,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
  revalidatePath("/admin/emails");
  // A missing-table error means the one-time migration hasn't been run yet.
  redirect(`/admin/emails?status=${error ? "migrate" : "saved"}#${key}`);
}

// Remove an override, reverting the template to its code default.
export async function resetTemplate(formData: FormData) {
  await requireOps();
  const key = String(formData.get("key") || "");
  if (!getTemplateDef(key)) redirect("/admin/emails?status=error");
  const sb = createServiceClient();
  await sb.from("email_templates").delete().eq("key", key);
  revalidatePath("/admin/emails");
  redirect(`/admin/emails?status=reset#${key}`);
}

// Send the rendered template (with sample data) to the signed-in admin.
export async function sendTest(formData: FormData) {
  const actor = await requireOps();
  const key = String(formData.get("key") || "");
  if (!getTemplateDef(key)) redirect("/admin/emails?status=error");
  if (!actor.email) redirect(`/admin/emails?status=noemail#${key}`);
  // Make sure it renders before attempting a send (surfaces template errors).
  await renderEmail(key, sampleVarsFor(key));
  const res = await sendTemplateTest(key, actor.email);
  redirect(`/admin/emails?status=${res ? "sent" : "noemail"}#${key}`);
}
