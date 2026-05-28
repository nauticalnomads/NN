import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
};

// Returns the signed-in admin user with their role, or null if not signed in
// or not in public.users. Use in admin pages/actions, never trust client state.
export async function getAdminUser(): Promise<AdminUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null; // No backend configured — treat as signed-out.
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active")
      .eq("id", user.id)
      .maybeSingle();
    const row = data as unknown as {
      id: string;
      email: string | null;
      full_name: string | null;
      role: UserRole;
      is_active: boolean;
    } | null;
    if (!row || !row.is_active) return null;
    return { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
  } catch {
    return null;
  }
}

// Role guards — call at the top of any admin page or server action. Redirect
// to /login on missing auth and to /admin (with a flash) on insufficient role.
export async function requireRole(allowed: UserRole[]): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/admin");
  if (!allowed.includes(user.role)) redirect("/admin?error=forbidden");
  return user;
}

export const requireMaster = () => requireRole(["master"]);
export const requireOps = () => requireRole(["master", "regular"]);
export const requireStaff = () => requireRole(["master", "regular", "content"]);
