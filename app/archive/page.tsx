import type { Metadata } from "next";
import Link from "next/link";
import { getIssues } from "@/lib/issues";

export const metadata: Metadata = {
  title: "Archive",
  description: "Past Friday issues of South Bay with Kids.",
};

export default function ArchivePage() {
  const issues = getIssues();

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium tracking-wide text-clay">Archive</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">
        Past Fridays
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        {issues.length === 0
          ? "Issues will show up here once the first letter goes out."
          : "Newest first. Each issue is the full letter with event cards."}
      </p>

      {issues.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-paper-deep/50 px-5 py-10">
          <p className="font-display text-xl text-ink">No issues yet</p>
          <p className="mt-2 text-ink-soft">
            First issue lands Friday. Check back then — or sign up on the
            homepage so it comes to you.
          </p>
        </div>
      ) : (
        <ol className="mt-10 divide-y divide-line border-y border-line">
          {issues.map((issue) => (
            <li key={issue.slug} className="py-5">
              <p className="text-sm text-ink-soft">{issue.dateLabel}</p>
              <p className="mt-1 font-display text-xl text-ink">
                <Link href={issue.href} className="hover:text-clay">
                  {issue.title}
                </Link>
              </p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
