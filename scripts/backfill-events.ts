/**
 * Materializes the Events API fields into content/issues/*.json.
 *
 *   npm run events:backfill           # write changes
 *   npm run events:backfill -- --check  # report only; exit 1 if anything would change
 *
 * Only keys that are missing are added; existing values (including explicit
 * nulls) are never overwritten, so hand edits survive re-runs. Run it after
 * adding a new issue, then review the diff.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { parseIssueData, parsePick, type EventPick, type Issue } from "../lib/issues";
import { deriveSchedule, splitAddress } from "../lib/events/derive";
import { deriveAllPicks } from "../lib/events/store";
import { formatLaIso, parseOffsetIso } from "../lib/events/time";
import { parseWhen } from "../lib/events/when";

const ISSUES_DIR = path.join(process.cwd(), "content", "issues");
const checkOnly = process.argv.includes("--check");

type RawPick = Record<string, unknown>;
type RawIssue = Record<string, unknown> & { picks: RawPick[] };

function gitLastCommitIso(file: string): string | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const ms = out ? parseOffsetIso(out) : null;
    return ms === null ? null : formatLaIso(ms);
  } catch {
    return null;
  }
}

const files = fs
  .readdirSync(ISSUES_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.json$/.test(f))
  .sort();

const raws = new Map<string, RawIssue>();
const rawByPick = new Map<EventPick, RawPick>();
const issues: Issue[] = [];
for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(ISSUES_DIR, file), "utf8")) as RawIssue;
  const issue = parseIssueData(raw, file);
  if (!issue) {
    console.warn(`skip ${file}: not a valid issue`);
    continue;
  }
  if (!raw.last_checked_at) {
    const committed = gitLastCommitIso(path.join("content", "issues", file));
    if (committed) raw.last_checked_at = committed;
  }
  issue.last_checked_at = typeof raw.last_checked_at === "string" ? raw.last_checked_at : undefined;
  issue.picks = [];
  for (const rawPick of raw.picks) {
    const pick = parsePick(rawPick);
    if (!pick) continue;
    issue.picks.push(pick);
    rawByPick.set(pick, rawPick);
  }
  raws.set(file, raw);
  issues.push(issue);
}

function setMissing(target: RawPick, key: string, value: unknown) {
  if (!(key in target)) target[key] = value;
}

const report: string[] = [];
for (const derived of deriveAllPicks(issues)) {
  const { pick, issue } = derived;
  const raw = rawByPick.get(pick)!;
  const label = `${issue.slug} · ${pick.name}`;

  const schedule = deriveSchedule(pick, issue.date);
  if (schedule) {
    setMissing(raw, "starts_at", formatLaIso(schedule.startMs));
    setMissing(raw, "ends_at", schedule.endMs !== null ? formatLaIso(schedule.endMs) : null);
    setMissing(raw, "time_tbd", schedule.timeTbd);
    for (const warning of parseWhen(pick.when, issue.date)?.warnings ?? []) {
      report.push(`note  ${label}: ${warning}`);
    }
  } else {
    setMissing(raw, "starts_at", null);
    report.push(`SKIP  ${label}: no specific start date in "${pick.when ?? ""}"`);
  }

  if (derived.record) setMissing(raw, "id", derived.record.event.id);
  else if (derived.reason !== "no specific start date") report.push(`SKIP  ${label}: ${derived.reason}`);

  const location = splitAddress(pick.address);
  setMissing(raw, "venue_name", location.venue);
  setMissing(raw, "street_address", location.street);
  setMissing(raw, "price_text", null);
  setMissing(raw, "image_url", null);
  setMissing(raw, "status", "scheduled");
  // Non-watch picks went through the newsletter's official-page fact check;
  // watch-list items are explicitly "confirm before you go".
  setMissing(raw, "verified", pick.section !== "watch");
}

/** Matches the file's existing style: some issues escape non-ASCII as \uXXXX. */
function serialize(raw: RawIssue, original: string): string {
  const { picks, ...meta } = raw;
  const json = JSON.stringify({ ...meta, picks }, null, 2);
  const escaped = /\\u[0-9a-f]{4}/i.test(original)
    ? json.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    : json;
  return `${escaped}\n`;
}

let changed = 0;
for (const [file, raw] of raws) {
  const target = path.join(ISSUES_DIR, file);
  const original = fs.readFileSync(target, "utf8");
  const next = serialize(raw, original);
  if (next === original) continue;
  changed += 1;
  if (!checkOnly) fs.writeFileSync(target, next);
  console.log(`${checkOnly ? "would update" : "updated"} ${file}`);
}
for (const line of report) console.log(line);
if (checkOnly && changed > 0) process.exit(1);
