// Owner attention-needed alerting (§B-07 §14/15). Every trigger site calls this
// right after inserting its `notifications` row. It reads the per-event
// `store_settings.notification_prefs` toggle and only emails the owner when that
// event type is enabled. Routine orders never reach here — they live in the
// admin dashboard / notifications inbox, not the owner's inbox.
import { createServiceClient } from "@/lib/supabase/service";
import { sendOwnerAlert } from "@/lib/email";
import type { NotificationType } from "@/lib/database.types";

// Reads notification_prefs; missing key defaults to ENABLED (matches the seeded
// default of all-true), so a new event type alerts unless explicitly silenced.
export async function notifyOwner(eventType: NotificationType, subject: string, body: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("store_settings")
    .select("notification_prefs")
    .eq("id", true)
    .maybeSingle();
  const prefs =
    (data as unknown as { notification_prefs: Record<string, boolean> } | null)
      ?.notification_prefs ?? {};
  if (prefs[eventType] === false) return { skipped: "pref-disabled" as const };
  await sendOwnerAlert(subject, body);
  return { sent: true as const };
}
