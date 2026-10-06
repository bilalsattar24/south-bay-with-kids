import { createHash } from "crypto";
import { getIssues, type EventPick, type Issue } from "../issues";
import { compareRecords, derivePick, type ApiEvent, type EventRecord } from "./derive";
import { formatLaIso, laDate } from "./time";

export type EventsDataset = {
  /** Deduped events sorted by start time then id. */
  records: EventRecord[];
  /** Latest `last_checked_at` across all events (LA ISO), or null if empty. */
  lastUpdated: string | null;
  /** Picks that could not be served, for the backfill report. */
  skipped: { issueSlug: string; title: string; reason: string }[];
};

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deterministic id for an occurrence: same official URL + same LA start date. */
export function computeEventId(url: string, startDate: string): string {
  const digest = createHash("sha256").update(`${normalizeUrl(url)}|${startDate}`).digest("hex");
  return `evt_${digest.slice(0, 16)}`;
}

function matchKeys(event: Pick<ApiEvent, "source_url" | "title" | "starts_at">, startMs: number) {
  const date = laDate(startMs);
  return [`u:${normalizeUrl(event.source_url)}|${date}`, `t:${normalizeTitle(event.title)}|${date}`];
}

export type DerivedPick =
  | { issue: Issue; pick: EventPick; record: EventRecord; reason?: undefined }
  | { issue: Issue; pick: EventPick; record?: undefined; reason: string };

/**
 * Derives every pick (oldest issue first) and assigns ids.
 *
 * A pick's stored `id` always wins. Picks without one reuse the id of any
 * event with the same URL or the same normalized title on the same LA start
 * date (stored ids first, then earlier issues); otherwise the id is computed
 * from URL + start date.
 */
export function deriveAllPicks(issues: Issue[]): DerivedPick[] {
  const ascending = [...issues].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const keyToId = new Map<string, string>();
  const results = ascending.flatMap((issue) =>
    issue.picks.map((pick) => ({ issue, pick, result: derivePick(pick, issue) })),
  );

  for (const { result } of results) {
    if (!result.ok || !result.record.event.id) continue;
    for (const key of matchKeys(result.record.event, result.record.startMs)) {
      if (!keyToId.has(key)) keyToId.set(key, result.record.event.id);
    }
  }

  return results.map(({ issue, pick, result }): DerivedPick => {
    if (!result.ok) return { issue, pick, reason: result.reason };
    const pending = result.record;
    let id = pending.event.id;
    if (!id) {
      const keys = matchKeys(pending.event, pending.startMs);
      id =
        keys.map((k) => keyToId.get(k)).find(Boolean) ??
        computeEventId(pending.event.source_url, laDate(pending.startMs));
      for (const key of keys) if (!keyToId.has(key)) keyToId.set(key, id);
    }
    return { issue, pick, record: { ...pending, event: { ...pending.event, id } } };
  });
}

/**
 * Turns issues into a deduped event list. When several picks share an id,
 * the one from the most recent issue is kept (first listing wins within a
 * single issue).
 */
export function buildEventsDataset(issues: Issue[]): EventsDataset {
  const skipped: EventsDataset["skipped"] = [];
  const byId = new Map<string, EventRecord>();
  const seenInIssue = new Set<string>();
  for (const derived of deriveAllPicks(issues)) {
    if (!derived.record) {
      skipped.push({ issueSlug: derived.issue.slug, title: derived.pick.name, reason: derived.reason });
      continue;
    }
    const issueKey = `${derived.issue.slug}|${derived.record.event.id}`;
    if (seenInIssue.has(issueKey)) continue;
    seenInIssue.add(issueKey);
    byId.set(derived.record.event.id, derived.record);
  }

  const records = [...byId.values()].sort(compareRecords);
  const lastCheckedMs = records.reduce(
    (max, r) => Math.max(max, Date.parse(r.event.last_checked_at)),
    Number.NEGATIVE_INFINITY,
  );
  return {
    records,
    lastUpdated: Number.isFinite(lastCheckedMs) ? formatLaIso(lastCheckedMs) : null,
    skipped,
  };
}

let cached: EventsDataset | null = null;

/**
 * Issue JSON ships with each deployment, so the dataset is built once per
 * server instance in production. In development it is rebuilt per request
 * so edits to content/issues show up immediately.
 */
export function getEventsDataset(): EventsDataset {
  if (process.env.NODE_ENV !== "production") return buildEventsDataset(getIssues());
  cached ??= buildEventsDataset(getIssues());
  return cached;
}
