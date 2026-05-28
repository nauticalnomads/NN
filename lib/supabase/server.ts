import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

// Server-side Supabase client bound to the request cookies (anon key + RLS).
// Use in Server Components, Route Handlers, and Server Actions. For trusted
// server contexts (no user session, bypass RLS), use createServiceClient
// from `@/lib/supabase/service` instead — that lives in its own file so it
// doesn't drag next/headers into client bundles.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore when middleware refreshes the session.
          }
        },
      },
    },
  );
}

// Re-export so existing imports keep working during migration.
export { createServiceClient } from "@/lib/supabase/service";
