import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

// Best-effort write to the audit_log table (same table the settings page reads).
// Never throws and no-ops if the table is missing, so an audit failure can never
// block the underlying admin action.
export async function writeAudit(
  actor: { id: string; email: string | null },
  action: string,
  detail: Json,
): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb
      .from("audit_log")
      .insert({ actor_id: actor.id, actor_email: actor.email, action, detail } as never)
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* best-effort */
  }
}
