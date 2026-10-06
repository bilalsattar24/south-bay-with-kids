import { addDays, isValidDate, weekdayOf } from "./time";

/**
 * Best-effort parser for the newsletter's free-text `when` strings, e.g.
 * "Saturday–Sunday, October 3–4, 10:00 a.m.–6:00 p.m. (parade 10 a.m.)".
 * Only the first date (range) and the first time (range) are used; text in
 * parentheses is ignored. Returns null when no specific date is stated.
 */
export type ParsedWhen = {
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const MONTH_PATTERN =
  "January|February|March|April|May|June|July|August|September|October|November|December|" +
  "Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const WEEKDAY_PATTERN =
  "Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Tues|Wed|Thu|Thurs|Fri|Sat";
const DASH = "[–—-]";
const MERIDIEM = "(a\\.m\\.|p\\.m\\.|am\\b|pm\\b)";
const NOON = 12 * 60;

const DATE_RE = new RegExp(
  `\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?!\\d)(?:,?\\s*(\\d{4}))?` +
    `(?:\\s*${DASH}\\s*(?:(?:${WEEKDAY_PATTERN}),?\\s+)?(?:(${MONTH_PATTERN})\\.?\\s+)?(\\d{1,2})(?![\\d:])(?!\\s*${MERIDIEM}))?` +
    `(?:,?\\s*(\\d{4}))?`,
  "i",
);
const RELATIVE_WEEKDAY_RE = new RegExp(
  `^(${WEEKDAYS.join("|")})s?\\b(?!\\s*[–—-])`,
  "i",
);
const TIME_RANGE_RE = new RegExp(
  `(?:\\b(noon)|(\\d{1,2})(?::(\\d{2}))?\\s*${MERIDIEM}?)\\s*[–-]\\s*(?:(noon)\\b|(\\d{1,2})(?::(\\d{2}))?\\s*${MERIDIEM})`,
  "i",
);
const SINGLE_TIME_RE = new RegExp(`(?:\\b(noon)\\b|(\\d{1,2})(?::(\\d{2}))?\\s*${MERIDIEM})`, "i");

function monthNumber(name: string): number {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

function toDate(year: number, month: number, day: number): string | null {
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidDate(date) ? date : null;
}

function to24h(hour: number, minute: number, meridiem: string | undefined): number | null {
  if (hour > 12 || minute > 59) return null;
  const m = meridiem?.toLowerCase().replace(/\./g, "");
  if (m === "am") return (hour % 12) * 60 + minute;
  if (m === "pm") return ((hour % 12) + 12) * 60 + minute;
  return null;
}

function fmtMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseTimes(text: string): { start: string | null; end: string | null } {
  const range = TIME_RANGE_RE.exec(text);
  const single = SINGLE_TIME_RE.exec(text);
  if (range && (!single || range.index <= single.index)) {
    const end = range[5] ? NOON : to24h(Number(range[6]), Number(range[7] ?? 0), range[8]);
    const hour = Number(range[2]);
    const minute = Number(range[3] ?? 0);
    let start = range[1] ? NOON : to24h(hour, minute, range[4] ?? range[8] ?? "pm");
    // "9:00–10:30 a.m." / "12–2 p.m.": an unmarked start borrows the end's
    // meridiem unless that would put it after the end ("11–1 p.m.").
    if (!range[1] && !range[4] && start !== null && end !== null && start > end) {
      start = to24h(hour, minute, "am");
    }
    if (start !== null) {
      return {
        start: fmtMinutes(start),
        end: end !== null && end > start ? fmtMinutes(end) : null,
      };
    }
  }
  if (single) {
    const minutes = single[1]
      ? NOON
      : to24h(Number(single[2]), Number(single[3] ?? 0), single[4]);
    if (minutes !== null) return { start: fmtMinutes(minutes), end: null };
  }
  return { start: null, end: null };
}

export function parseWhen(when: string | undefined, issueDate: string): ParsedWhen | null {
  if (!when) return null;
  const text = when
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^(select nights\s+|continues\s+)?through\b/i.test(text)) return null;

  const warnings: string[] = [];
  const issueYear = Number(issueDate.slice(0, 4));
  const match = DATE_RE.exec(text);
  let startDate: string | null = null;
  let endDate: string | null = null;
  let rest = text;

  if (match) {
    const startMonth = monthNumber(match[1]);
    const explicitYear = match[3] ?? match[6];
    let year = explicitYear ? Number(explicitYear) : issueYear;
    startDate = toDate(year, startMonth, Number(match[2]));
    if (!startDate) return null;
    if (!explicitYear && startDate < addDays(issueDate, -180)) {
      year += 1;
      startDate = toDate(year, startMonth, Number(match[2]));
      if (!startDate) return null;
    }
    if (match[5]) {
      const endMonth = match[4] ? monthNumber(match[4]) : startMonth;
      const endYear = endMonth < startMonth ? year + 1 : year;
      endDate = toDate(endYear, endMonth, Number(match[5]));
      if (endDate && endDate <= startDate) endDate = null;
    }
    rest = text.slice(0, match.index) + " | " + text.slice(match.index + match[0].length);

    const leadingWeekday = text.match(new RegExp(`^(${WEEKDAYS.join("|")})\\b`, "i"));
    if (leadingWeekday) {
      const expected = WEEKDAYS.indexOf(leadingWeekday[1].toLowerCase());
      if (weekdayOf(startDate) !== expected) {
        warnings.push(`"${leadingWeekday[1]}" does not match ${startDate}`);
      }
    }
  } else {
    const relative = RELATIVE_WEEKDAY_RE.exec(text);
    if (!relative) return null;
    const target = WEEKDAYS.indexOf(relative[1].toLowerCase());
    const delta = (target - weekdayOf(issueDate) + 7) % 7;
    startDate = addDays(issueDate, delta);
    rest = text.slice(relative[0].length);
    warnings.push(`relative weekday "${relative[0]}" resolved against issue date ${issueDate}`);
  }

  const times = parseTimes(rest.replace(/\b\d{4}\b/g, " "));
  return {
    startDate,
    endDate,
    startTime: times.start,
    endTime: times.end,
    warnings,
  };
}
