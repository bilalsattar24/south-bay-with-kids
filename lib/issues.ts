import fs from "fs";
import path from "path";

export type Issue = {
  slug: string;
  date: string;
  dateLabel: string;
  title: string;
  href?: string;
};

const ISSUES_DIR = path.join(process.cwd(), "content", "issues");

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

function readTitle(filePath: string, fallback: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (fm) {
      const titleLine = fm[1].match(/^title:\s*(.+)$/m);
      if (titleLine) {
        return titleLine[1].trim().replace(/^["']|["']$/g, "");
      }
    }
    const heading = raw.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
  } catch {
    // Folder can be empty; pages still render.
  }
  return fallback;
}

export function getIssues(): Issue[] {
  if (!fs.existsSync(ISSUES_DIR)) return [];

  return fs
    .readdirSync(ISSUES_DIR)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
    .map((file) => {
      const name = file.replace(/\.mdx?$/, "");
      const match = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      const date = match?.[1] ?? "";
      const slugPart = match?.[2] ?? name;
      const title = readTitle(
        path.join(ISSUES_DIR, file),
        titleFromSlug(slugPart),
      );

      return {
        slug: name,
        date,
        dateLabel: date ? formatDate(date) : "",
        title,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
