import Link from "next/link";
import { Container } from "@/components/Container";
import { Logo } from "@/components/Logo";

const nav = [
  { href: "/", label: "Shop" },
  { href: "/styleguide", label: "Styleguide" },
];

export function Header() {
  return (
    <header className="border-b border-ink/10 bg-surface">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="no-underline">
          <Logo />
        </Link>
        <nav className="flex items-center gap-7">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-xs tracking-wide text-ink uppercase no-underline transition-colors hover:text-accent-sun"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
