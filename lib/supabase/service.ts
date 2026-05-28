import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Privileged server client (service role) — bypasses RLS. NEVER import into
// client code. Lives in its OWN file (no next/headers) so server actions and
// migration scripts can use it without dragging cookies() into client bundles.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
