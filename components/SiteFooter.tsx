import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-line/80">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <p className="font-display text-lg text-ink">South Bay with Kids</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          For parents with kids in the South Bay — Torrance and nearby — plus
          the occasional outing within about an hour&apos;s drive.
        </p>
        <nav aria-label="Footer" className="mt-5">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <li>
              <Link href="/" className="text-ink-soft hover:text-ink">
                Home
              </Link>
            </li>
            <li>
              <Link href="/archive" className="text-ink-soft hover:text-ink">
                Archive
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-ink-soft hover:text-ink">
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
