export const EVENTS_TIME_ZONE = "America/Los_Angeles";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENTS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(ms: number): LocalParts {
  const out: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(new Date(ms))) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

function pad(n: number, width = 2) {
  return String(Math.abs(n)).padStart(width, "0");
}

/** Offset of LA from UTC in minutes at the given instant (e.g. -420 for PDT). */
export function laOffsetMinutes(ms: number): number {
  const wholeSecond = Math.floor(ms / 1000) * 1000;
  const p = localParts(wholeSecond);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - wholeSecond) / 60000);
}

export function isValidDate(date: string): boolean {
  const m = date.match(DATE_RE);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

/** Epoch ms for a wall-clock date/time in LA ("2026-10-03", "10:00"). */
export function laLocalToEpoch(date: string, time = "00:00:00"): number {
  const m = date.match(DATE_RE);
  const t = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m || !t) throw new Error(`Invalid local date/time: ${date} ${time}`);
  const guess = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(t[1]),
    Number(t[2]),
    Number(t[3] ?? 0),
  );
  const first = guess - laOffsetMinutes(guess) * 60000;
  const second = guess - laOffsetMinutes(first) * 60000;
  return second;
}

/** ISO 8601 in LA wall-clock time with the UTC offset, e.g. 2026-10-03T10:00:00-07:00. */
export function formatLaIso(ms: number): string {
  const wholeSecond = Math.floor(ms / 1000) * 1000;
  const p = localParts(wholeSecond);
  const offset = laOffsetMinutes(wholeSecond);
  const sign = offset < 0 ? "-" : "+";
  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.trunc(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

/** Calendar date (YYYY-MM-DD) in LA for an instant. */
export function laDate(ms: number): string {
  const p = localParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(date: string, days: number): string {
  const m = date.match(DATE_RE);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekdayOf(date: string): number {
  const m = date.match(DATE_RE);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Monday–Sunday of the LA calendar week containing `now`. */
export function currentLaWeek(now: Date): { from: string; to: string } {
  const monday = mondayOf(laDate(now.getTime()));
  return { from: monday, to: addDays(monday, 6) };
}

/** Parses an ISO 8601 timestamp that carries an explicit offset (or Z). */
export function parseOffsetIso(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
