import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const NAV: { href: string; label: string; allowed: UserRole[] }[] = [
  { href: "/admin", label: "Dashboard", allowed: ["master", "regular", "content"] },
  {
    href: "/admin/content",
    label: "Homepage & Content",
    allowed: ["master", "regular", "content"],
  },
  { href: "/admin/products", label: "Products", allowed: ["master", "regular", "content"] },
  { href: "/admin/collections", label: "Collections", allowed: ["master", "regular", "content"] },
  { href: "/admin/orders", label: "Orders", allowed: ["master", "regular"] },
  { href: "/admin/refunds", label: "Refunds", allowed: ["master", "regular"] },
  { href: "/admin/financial", label: "Financial", allowed: ["master", "regular"] },
  { href: "/admin/notifications", label: "Notifications", allowed: ["master", "regular"] },
  { href: "/admin/social", label: "Social", allowed: ["master", "regular", "content"] },
  { href: "/admin/blog", label: "Blog", allowed: ["master", "regular", "content"] },
  { href: "/admin/settings", label: "Settings", allowed: ["master", "regular"] },
  { href: "/admin/users", label: "Users", allowed: ["master"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/admin");

  const items = NAV.filter((i) => i.allowed.includes(user.role));

  // Unread notification count for the nav badge (ops only; RLS limits reads).
  let unread = 0;
  if (user.role === "master" || user.role === "regular") {
    try {
      const sb = await createClient();
      const { count } = await sb
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .is("read_at", null);
      unread = count ?? 0;
    } catch {
      unread = 0;
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[14rem_1fr]">
      <aside className="border-b border-ink/10 bg-surface-2 px-5 py-6 lg:border-b-0 lg:border-r">
        <div className="flex items-baseline justify-between lg:block">
          <div>
            <p className="font-display text-xl tracking-tight text-ink">Nautical Nomads</p>
            <p className="mt-0.5 font-mono text-caption tracking-wide text-ink/50 uppercase">
              Admin
            </p>
          </div>
          <nav className="mt-0 flex gap-4 lg:mt-10 lg:block lg:space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 font-body text-body text-ink/80 no-underline hover:text-accent-sun"
              >
                {item.label}
                {item.href === "/admin/notifications" && unread > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-sun px-1.5 py-0.5 font-mono text-[10px] leading-none text-surface">
                    {unread}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 hidden lg:block">
          <p className="font-mono text-caption text-ink/50">{user.email}</p>
          <p className="mt-1 font-mono text-caption text-ink/40">role: {user.role}</p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="font-mono text-caption tracking-wide text-ink/70 uppercase underline-offset-4 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="px-6 py-10 lg:px-12">{children}</div>
    </div>
  );
}
