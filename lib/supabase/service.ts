import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Privileged server client (service role) — bypasses RLS. NEVER import into
// client code. Lives in its OWN file (no next/headers) so server actions and
// migration scripts can use it without dragging cookies() into client bundles.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Fail with a clear message rather than an opaque "fetch failed" deep in a
  // query when the env isn't wired up.
  if (!url || !key) {
    throw new Error(
      `Supabase service client misconfigured (url=${!!url}, serviceKey=${!!key}). ` +
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
