import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const NAV: { href: string; label: string; allowed: UserRole[] }[] = [
  { href: "/admin", label: "Dashboard", allowed: ["master", "regular", "content"] },
  { href: "/admin/products", label: "Products", allowed: ["master", "regular", "content"] },
  { href: "/admin/collections", label: "Collections", allowed: ["master", "regular", "content"] },
  { href: "/admin/orders", label: "Orders", allowed: ["master", "regular"] },
  { href: "/admin/refunds", label: "Refunds", allowed: ["master", "regular"] },
  { href: "/admin/financial", label: "Financial", allowed: ["master", "regular"] },
  { href: "/admin/social", label: "Social", allowed: ["master", "regular", "content"] },
  { href: "/admin/blog", label: "Blog", allowed: ["master", "regular", "content"] },
  { href: "/admin/settings", label: "Settings", allowed: ["master", "regular"] },
  { href: "/admin/users", label: "Users", allowed: ["master"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/admin");

  const items = NAV.filter((i) => i.allowed.includes(user.role));

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
                className="block font-body text-body text-ink/80 no-underline hover:text-accent-sun"
              >
                {item.label}
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
