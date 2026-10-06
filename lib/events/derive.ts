import type { EventPick, Issue } from "../issues";
import { addDays, formatLaIso, laDate, laLocalToEpoch, parseOffsetIso, weekdayOf } from "./time";
import { parseWhen } from "./when";

export const API_CATEGORIES = ["this_weekend", "worth_the_drive", "free_this_week"] as const;
export type ApiCategory = (typeof API_CATEGORIES)[number];

export const EVENT_STATUSES = ["scheduled", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Event object returned by GET /api/v1/events. */
export type ApiEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  time_tbd: boolean;
  venue_name: string;
  address: string | null;
  city: string;
  is_free: boolean;
  price_text: string | null;
  age_range: string | null;
  description: string;
  category: ApiCategory;
  source_url: string;
  image_url: string | null;
  status: EventStatus;
  verified: boolean;
  last_checked_at: string;
};

/** An event plus the bookkeeping needed to filter, sort and dedupe it. */
export type EventRecord = {
  event: ApiEvent;
  startMs: number;
  endMs: number;
  issueDate: string;
  issueSlug: string;
  /** True when `event.id` came from the issue JSON rather than being derived. */
  storedId: boolean;
};

/** Sort order of the API: `starts_at` ascending, then `id` as a tiebreaker. */
export function compareRecords(a: EventRecord, b: EventRecord): number {
  if (a.startMs !== b.startMs) return a.startMs - b.startMs;
  return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
}

/**
 * Cities treated as "home turf". Events elsewhere (Long Beach, Downey,
 * West Hollywood, central LA, …) map to `worth_the_drive`.
 */
export const SOUTH_BAY_CITIES = new Set(
  [
    "Carson",
    "El Segundo",
    "Gardena",
    "Harbor City",
    "Harbor Gateway",
    "Hawthorne",
    "Hermosa Beach",
    "Lawndale",
    "Lomita",
    "Manhattan Beach",
    "Palos Verdes Estates",
    "Palos Verdes Peninsula",
    "Rancho Palos Verdes",
    "Redondo Beach",
    "Rolling Hills",
    "Rolling Hills Estates",
    "San Pedro",
    "Torrance",
    "Wilmington",
  ].map((c) => c.toLowerCase()),
);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function toPlainText(value: string): string {
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Torrance (choose Torrance store when registering)" → "Torrance". */
export function cleanCity(city: string | undefined): string | null {
  if (!city) return null;
  const cleaned = toPlainText(city.replace(/\([^)]*\)/g, " "));
  return cleaned || null;
}

/**
 * Splits the free-text `address` ("Venue, 123 Street (note)") into a venue
 * name and a street address. Anything that is not clearly one of those is
 * dropped rather than guessed.
 */
export function splitAddress(address: string | undefined): {
  venue: string | null;
  street: string | null;
} {
  if (!address) return { venue: null, street: null };
  const cleaned = toPlainText(address.replace(/\([^)]*\)/g, " ").split(/\s+[—–]\s+/)[0])
    .replace(/\s*,\s*$/, "");
  if (!cleaned) return { venue: null, street: null };
  const comma = cleaned.indexOf(",");
  const head = (comma === -1 ? cleaned : cleaned.slice(0, comma)).trim();
  const tail = comma === -1 ? "" : cleaned.slice(comma + 1).trim();
  if (/^\d/.test(head)) return { venue: null, street: cleaned };
  return { venue: head, street: /^\d/.test(tail) ? tail : null };
}

export function mapCategory(input: {
  section: EventPick["section"];
  city: string;
  startDate: string;
  isFree: boolean;
}): ApiCategory {
  if (input.section === "free-this-week") return "free_this_week";
  const cityParts = input.city.split("/").map((c) => c.trim().toLowerCase());
  if (!cityParts.some((c) => SOUTH_BAY_CITIES.has(c))) return "worth_the_drive";
  if (input.section === "this-weekend") return "this_weekend";
  // coming-up / watch: weekday freebies read as "free this week",
  // everything else is a weekend plan.
  const dow = weekdayOf(input.startDate);
  const isWeekday = dow >= 1 && dow <= 4;
  return isWeekday && input.isFree ? "free_this_week" : "this_weekend";
}

export type Schedule = {
  startMs: number;
  endMs: number | null;
  timeTbd: boolean;
};

/** Start/end from stored ISO fields if present, else parsed from `when`. */
export function deriveSchedule(pick: EventPick, issueDate: string): Schedule | null {
  if (pick.starts_at !== undefined) {
    if (pick.starts_at === null) return null;
    const startMs = parseOffsetIso(pick.starts_at);
    if (startMs === null) return null;
    const endMs = pick.ends_at ? parseOffsetIso(pick.ends_at) : null;
    return {
      startMs,
      endMs: endMs !== null && endMs >= startMs ? endMs : null,
      timeTbd: pick.time_tbd ?? false,
    };
  }

  const parsed = parseWhen(pick.when, issueDate);
  if (!parsed) return null;
  if (!parsed.startTime) {
    return {
      startMs: laLocalToEpoch(parsed.startDate),
      endMs: parsed.endDate ? laLocalToEpoch(addDays(parsed.endDate, 1)) - 1000 : null,
      timeTbd: true,
    };
  }
  const startMs = laLocalToEpoch(parsed.startDate, parsed.startTime);
  const endMs = parsed.endTime
    ? laLocalToEpoch(parsed.endDate ?? parsed.startDate, parsed.endTime)
    : parsed.endDate
      ? laLocalToEpoch(addDays(parsed.endDate, 1)) - 1000
      : null;
  return { startMs, endMs: endMs !== null && endMs > startMs ? endMs : null, timeTbd: false };
}

function isCategory(value: string | undefined): value is ApiCategory {
  return !!value && (API_CATEGORIES as readonly string[]).includes(value);
}

function isStatus(value: string | undefined): value is EventStatus {
  return !!value && (EVENT_STATUSES as readonly string[]).includes(value);
}

export type DeriveResult =
  | { ok: true; record: Omit<EventRecord, "event"> & { event: Omit<ApiEvent, "id"> & { id: string | null } } }
  | { ok: false; reason: string };

/**
 * Builds the API view of one newsletter pick. Picks without a usable start
 * date or city are skipped (reported via `reason`) rather than guessed.
 */
export function derivePick(pick: EventPick, issue: Issue): DeriveResult {
  const schedule = deriveSchedule(pick, issue.date);
  if (!schedule) return { ok: false, reason: "no specific start date" };

  const city = cleanCity(pick.city);
  if (!city) return { ok: false, reason: "no city" };

  const location = splitAddress(pick.address);
  const street = pick.street_address !== undefined ? pick.street_address : location.street;
  const venue =
    (pick.venue_name !== undefined ? pick.venue_name : location.venue) ?? street ?? city;

  const isFree =
    pick.is_free ?? (pick.cost_kind === "free" || pick.cost_kind === "suggested-donation");
  const startDate = laDate(schedule.startMs);
  const category = isCategory(pick.category)
    ? pick.category
    : mapCategory({ section: pick.section, city, startDate, isFree });

  const checkedMs =
    (pick.last_checked_at && parseOffsetIso(pick.last_checked_at)) ||
    (issue.last_checked_at && parseOffsetIso(issue.last_checked_at)) ||
    laLocalToEpoch(issue.date);

  return {
    ok: true,
    record: {
      startMs: schedule.startMs,
      endMs: schedule.endMs ?? schedule.startMs,
      issueDate: issue.date,
      issueSlug: issue.slug,
      storedId: !!pick.id,
      event: {
        id: pick.id ?? null,
        title: toPlainText(pick.name),
        starts_at: formatLaIso(schedule.startMs),
        ends_at: schedule.endMs !== null ? formatLaIso(schedule.endMs) : null,
        time_tbd: schedule.timeTbd,
        venue_name: toPlainText(venue),
        address: street ? toPlainText(street) : null,
        city,
        is_free: isFree,
        price_text: isFree && pick.cost_kind === "free" ? null : (pick.price_text ?? null),
        age_range: pick.age_gate ? toPlainText(pick.age_gate).replace(/\.$/, "") : null,
        description: toPlainText(pick.description ?? pick.why ?? pick.name),
        category,
        source_url: pick.url,
        image_url: pick.image_url ?? null,
        status: isStatus(pick.status) ? pick.status : "scheduled",
        verified: pick.verified ?? false,
        last_checked_at: formatLaIso(checkedMs),
      },
    },
  };
}
