import Link from "next/link";
import { getLatestIssue } from "@/lib/issues";

export function LatestIssue() {
  const latest = getLatestIssue();

  return (
    <section className="mx-auto max-w-2xl px-5 py-14 sm:px-6 sm:py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl tracking-tight text-ink">
          Latest issue
        </h2>
        <Link
          href="/archive"
          className="inline-flex min-h-11 items-center text-sm text-clay hover:text-clay-deep"
        >
          Archive
        </Link>
      </div>

      {latest ? (
        <article className="mt-6 rounded-2xl border border-line bg-white/60 px-5 py-6">
          <p className="text-sm text-ink-soft">{latest.dateLabel}</p>
          <h3 className="mt-1 font-display text-2xl text-ink">
            <Link href={latest.href} className="hover:text-clay">
              {latest.title}
            </Link>
          </h3>
          <p className="mt-3 leading-relaxed text-ink-soft">{latest.intro}</p>
          <p className="mt-4">
            <Link
              href={latest.href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:text-clay-deep"
            >
              Read the issue
            </Link>
          </p>
        </article>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-8">
          <p className="font-display text-2xl text-ink">
            First issue lands Friday
          </p>
          <p className="mt-2 text-ink-soft">
            Nothing to archive yet. Here is the shape of a letter, empty on
            purpose.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-ink-soft/80">
            <li className="rounded-lg bg-paper-deep px-4 py-3">This weekend</li>
            <li className="rounded-lg bg-paper-deep px-4 py-3">
              Worth the drive
            </li>
            <li className="rounded-lg bg-paper-deep px-4 py-3">Free this week</li>
          </ul>
        </div>
      )}
    </section>
  );
}
