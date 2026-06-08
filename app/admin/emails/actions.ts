"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getTemplateDef, sampleVarsFor, renderEmail } from "@/lib/email-templates";
import { sendTemplateTest } from "@/lib/email";

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
