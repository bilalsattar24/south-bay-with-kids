import { createHash } from "crypto";
import {
  API_CATEGORIES,
  compareRecords,
  type ApiCategory,
  type ApiEvent,
  type EventRecord,
} from "./derive";
import { addDays, currentLaWeek, isValidDate, laLocalToEpoch, mondayOf } from "./time";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export const MAX_RANGE_DAYS = 366;

/** Query-string names that look like credentials; always rejected. */
export const CREDENTIAL_PARAMS = ["api_key", "apikey", "key", "token", "access_token", "auth"];

export type EventsQuery = {
  from: string;
  to: string;
  category: ApiCategory | null;
  limit: number;
  includeCancelled: boolean;
  cursor: { startMs: number; id: string } | null;
};

export type QueryError = { code: string; message: string };

type CursorPayload = { v: 1; s: number; i: string; q: string };

function filterFingerprint(q: Pick<EventsQuery, "from" | "to" | "category" | "includeCancelled">) {
  return createHash("sha256")
    .update(`${q.from}|${q.to}|${q.category ?? ""}|${q.includeCancelled}`)
    .digest("base64url")
    .slice(0, 12);
}

export function encodeCursor(record: EventRecord, query: EventsQuery): string {
  const payload: CursorPayload = { v: 1, s: record.startMs, i: record.event.id, q: filterFingerprint(query) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(raw: string): CursorPayload | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(raw)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.s !== "number" ||
      !Number.isFinite(parsed.s) ||
      typeof parsed.i !== "string" ||
      typeof parsed.q !== "string"
    ) {
      return null;
    }
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

function single(params: URLSearchParams, name: string): string | null | QueryError {
  const values = params.getAll(name);
  if (values.length > 1) {
    return { code: "invalid_parameter", message: `\`${name}\` may only be given once.` };
  }
  return values.length === 1 ? values[0].trim() : null;
}

function isError(value: unknown): value is QueryError {
  return typeof value === "object" && value !== null && "code" in value;
}

export function findCredentialParam(params: URLSearchParams): string | null {
  for (const name of params.keys()) {
    if (CREDENTIAL_PARAMS.includes(name.toLowerCase())) return name;
  }
  return null;
}

/**
 * Validates query parameters. When only one of `from`/`to` is given the
 * other defaults to the same Monday–Sunday week; when neither is given the
 * current LA week is used.
 */
export function parseEventsQuery(
  params: URLSearchParams,
  now: Date,
): { ok: true; query: EventsQuery } | { ok: false; error: QueryError } {
  const fail = (message: string, code = "invalid_parameter") => ({ ok: false as const, error: { code, message } });

  const values: Record<string, string | null> = {};
  for (const name of ["from", "to", "category", "limit", "cursor", "include_cancelled"]) {
    const value = single(params, name);
    if (isError(value)) return { ok: false, error: value };
    values[name] = value === "" ? null : value;
  }

  for (const name of ["from", "to"] as const) {
    const value = values[name];
    if (value !== null && !isValidDate(value)) {
      return fail(`\`${name}\` must be a calendar date in YYYY-MM-DD format.`);
    }
  }
  let from = values.from;
  let to = values.to;
  if (!from && !to) {
    ({ from, to } = currentLaWeek(now));
  } else if (from && !to) {
    to = addDays(mondayOf(from), 6);
  } else if (!from && to) {
    from = mondayOf(to);
  }
  if (!from || !to) return fail("Could not resolve date range.");
  if (from > to) return fail("`from` must be on or before `to`.");
  const rangeDays = (laLocalToEpoch(to) - laLocalToEpoch(from)) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS) return fail(`Date range may not exceed ${MAX_RANGE_DAYS} days.`);

  let category: ApiCategory | null = null;
  if (values.category !== null) {
    if (!(API_CATEGORIES as readonly string[]).includes(values.category)) {
      return fail(`\`category\` must be one of: ${API_CATEGORIES.join(", ")}.`);
    }
    category = values.category as ApiCategory;
  }

  let limit = DEFAULT_LIMIT;
  if (values.limit !== null) {
    if (!/^\d{1,6}$/.test(values.limit) || Number(values.limit) < 1) {
      return fail(`\`limit\` must be an integer between 1 and ${MAX_LIMIT}.`);
    }
    limit = Math.min(Number(values.limit), MAX_LIMIT);
  }

  let includeCancelled = false;
  if (values.include_cancelled !== null) {
    const v = values.include_cancelled.toLowerCase();
    if (v === "true" || v === "1") includeCancelled = true;
    else if (v === "false" || v === "0") includeCancelled = false;
    else return fail("`include_cancelled` must be `true` or `false`.");
  }

  const query: EventsQuery = { from, to, category, limit, includeCancelled, cursor: null };
  if (values.cursor !== null) {
    const decoded = decodeCursor(values.cursor);
    if (!decoded) return fail("`cursor` is malformed.", "invalid_cursor");
    if (decoded.q !== filterFingerprint(query)) {
      return fail(
        "`cursor` was issued for different filters; repeat the original from/to/category/include_cancelled.",
        "invalid_cursor",
      );
    }
    query.cursor = { startMs: decoded.s, id: decoded.i };
  }
  return { ok: true, query };
}

/**
 * Events overlapping [from 00:00, to 24:00) LA time, sorted by start then
 * id, after the cursor position, capped at `limit`.
 */
export function applyEventsQuery(
  records: EventRecord[],
  query: EventsQuery,
): { events: ApiEvent[]; nextCursor: string | null } {
  const rangeStart = laLocalToEpoch(query.from);
  const rangeEnd = laLocalToEpoch(addDays(query.to, 1));
  const cursor = query.cursor;

  const matching = [...records].sort(compareRecords).filter((r) => {
    if (r.startMs >= rangeEnd || r.endMs < rangeStart) return false;
    if (!query.includeCancelled && r.event.status === "cancelled") return false;
    if (query.category && r.event.category !== query.category) return false;
    if (cursor) {
      if (r.startMs < cursor.startMs) return false;
      if (r.startMs === cursor.startMs && r.event.id <= cursor.id) return false;
    }
    return true;
  });

  const page = matching.slice(0, query.limit);
  const nextCursor =
    matching.length > query.limit ? encodeCursor(page[page.length - 1], query) : null;
  return { events: page.map((r) => r.event), nextCursor };
}
