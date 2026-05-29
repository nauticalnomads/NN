import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Anon, cookies-free Supabase client for storefront reads. Use this in pages
// that benefit from SSG/ISR — the cookies-using server client makes those
// pages dynamic at runtime, which conflicts with generateStaticParams.
// RLS still applies (we pass the anon key), so only `published` rows come
// back per our §3 policies.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
