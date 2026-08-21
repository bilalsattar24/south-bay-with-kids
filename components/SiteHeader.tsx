import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-ink sm:text-xl"
        >
          South Bay with Kids
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center px-2.5 text-sm text-ink-soft hover:text-ink sm:px-3"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
