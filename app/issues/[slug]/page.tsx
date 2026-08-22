import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PickCard } from "@/components/PickCard";
import {
  getIssue,
  getIssues,
  ISSUE_SECTIONS,
  SECTION_LABELS,
} from "@/lib/issues";

type IssuePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getIssues().map((issue) => ({ slug: issue.slug }));
}

export async function generateMetadata({
  params,
}: IssuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const issue = getIssue(slug);
  if (!issue) return { title: "Issue" };
  return {
    title: issue.title,
    description: issue.intro,
  };
}

export default async function IssuePage({ params }: IssuePageProps) {
  const { slug } = await params;
  const issue = getIssue(slug);
  if (!issue) notFound();

  const sections = ISSUE_SECTIONS.filter((section) =>
    issue.picks.some((pick) => pick.section === section),
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium tracking-wide text-clay">
        {issue.dateLabel}
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">
        {issue.title}
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
        {issue.intro.split(/\n\n+/).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {sections.map((section) => {
        const picks = issue.picks.filter((pick) => pick.section === section);
        return (
          <section key={section} className="mt-12">
            <h2 className="font-display text-3xl tracking-tight text-ink">
              {SECTION_LABELS[section]}
            </h2>
            <div className="mt-6 space-y-5">
              {picks.map((pick) => (
                <PickCard key={`${pick.section}-${pick.url}`} pick={pick} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-12 text-sm text-ink-soft">
        <Link href="/archive" className="text-clay hover:text-clay-deep">
          All issues
        </Link>
      </p>
    </main>
  );
}
