import fs from "fs";
import path from "path";

export const ISSUE_SECTIONS = [
  "this-weekend",
  "coming-up",
  "free-this-week",
  "watch",
] as const;

export type IssueSection = (typeof ISSUE_SECTIONS)[number];

export type CostKind = "free" | "required" | "suggested-donation";

export type EventPick = {
  name: string;
  url: string;
  section: IssueSection;
  when?: string;
  city?: string;
  address?: string;
  family_of_4_estimate: number | null;
  cost_math?: string;
  cost_kind?: CostKind;
  parking?: string;
  food?: string;
  why?: string;
  age_gate?: string;
};

export type Issue = {
  slug: string;
  date: string;
  dateLabel: string;
  title: string;
  intro: string;
  href: string;
  picks: EventPick[];
};

const ISSUES_DIR = path.join(process.cwd(), "content", "issues");
const ISSUE_FILE = /^(\d{4}-\d{2}-\d{2})-(.+)\.json$/;
const SECTIONS = new Set<string>(ISSUE_SECTIONS);
const COST_KINDS = new Set<string>(["free", "required", "suggested-donation"]);

function formatDate(iso: string) {
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePick(raw: unknown): EventPick | null {
  if (!raw || typeof raw !== "object") return null;
  const pick = raw as Record<string, unknown>;
  const name = asTrimmedString(pick.name);
  const url = asTrimmedString(pick.url);
  const section = asTrimmedString(pick.section);
  if (!name || !url || !section || !SECTIONS.has(section)) return null;

  const estimate = pick.family_of_4_estimate;
  if (estimate !== null && typeof estimate !== "number") return null;

  const costKind = asTrimmedString(pick.cost_kind);
  if (costKind && !COST_KINDS.has(costKind)) return null;

  return {
    name,
    url,
    section: section as IssueSection,
    when: asTrimmedString(pick.when),
    city: asTrimmedString(pick.city),
    address: asTrimmedString(pick.address),
    family_of_4_estimate: estimate,
    cost_math: asTrimmedString(pick.cost_math),
    cost_kind: costKind as CostKind | undefined,
    parking: asTrimmedString(pick.parking),
    food: asTrimmedString(pick.food),
    why: asTrimmedString(pick.why),
    age_gate: asTrimmedString(pick.age_gate),
  };
}

function parseIssueFile(file: string): Issue | null {
  const match = file.match(ISSUE_FILE);
  if (!match) return null;

  const filePath = path.join(ISSUES_DIR, file);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const date = asTrimmedString(data.date) ?? match[1];
  const title = asTrimmedString(data.title);
  const intro = asTrimmedString(data.intro);
  if (!title || !intro || !Array.isArray(data.picks)) return null;

  const picks = data.picks
    .map(parsePick)
    .filter((pick): pick is EventPick => pick !== null);
  const slug = file.replace(/\.json$/, "");

  return {
    slug,
    date,
    dateLabel: formatDate(date),
    title,
    intro,
    href: `/issues/${slug}`,
    picks,
  };
}

export function getIssues(): Issue[] {
  if (!fs.existsSync(ISSUES_DIR)) return [];

  return fs
    .readdirSync(ISSUES_DIR)
    .map(parseIssueFile)
    .filter((issue): issue is Issue => issue !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getIssue(slug: string): Issue | undefined {
  return getIssues().find((issue) => issue.slug === slug);
}

export function getLatestIssue(): Issue | undefined {
  return getIssues()[0];
}

export const SECTION_LABELS: Record<IssueSection, string> = {
  "this-weekend": "This weekend",
  "coming-up": "Coming up",
  "free-this-week": "Free this week",
  watch: "Watch",
};
