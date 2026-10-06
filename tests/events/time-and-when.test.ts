import { describe, expect, it } from "vitest";
import {
  currentLaWeek,
  formatLaIso,
  laLocalToEpoch,
  parseOffsetIso,
} from "@/lib/events/time";
import { parseWhen } from "@/lib/events/when";

describe("LA time helpers", () => {
  it("formats with the daylight or standard offset", () => {
    expect(formatLaIso(laLocalToEpoch("2026-10-03", "10:00"))).toBe("2026-10-03T10:00:00-07:00");
    expect(formatLaIso(laLocalToEpoch("2026-12-05", "10:00"))).toBe("2026-12-05T10:00:00-08:00");
  });

  it("handles the DST change day", () => {
    // 2026-11-01: clocks fall back at 02:00 PDT.
    expect(formatLaIso(laLocalToEpoch("2026-11-01", "00:00"))).toBe("2026-11-01T00:00:00-07:00");
    expect(formatLaIso(laLocalToEpoch("2026-11-01", "12:00"))).toBe("2026-11-01T12:00:00-08:00");
  });

  it("computes Monday–Sunday of the current LA week", () => {
    // Monday 03:00 UTC is still Sunday evening in LA.
    expect(currentLaWeek(new Date("2026-10-05T03:00:00Z"))).toEqual({
      from: "2026-09-28",
      to: "2026-10-04",
    });
    expect(currentLaWeek(new Date("2026-10-05T18:00:00Z"))).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("only accepts ISO strings with an explicit offset", () => {
    expect(parseOffsetIso("2026-10-03T10:00:00-07:00")).toBe(Date.parse("2026-10-03T17:00:00Z"));
    expect(parseOffsetIso("2026-10-03T10:00:00")).toBeNull();
    expect(parseOffsetIso("October 3")).toBeNull();
  });
});

describe("parseWhen", () => {
  const ISSUE = "2026-10-02";

  it("parses a single day with a time range", () => {
    expect(parseWhen("Saturday, October 3, 4:00–9:00 p.m. (Trunk-or-Treat 4:00–7:00 p.m.)", ISSUE)).toMatchObject({
      startDate: "2026-10-03",
      endDate: null,
      startTime: "16:00",
      endTime: "21:00",
      warnings: [],
    });
  });

  it("borrows the meridiem from the end of the range", () => {
    expect(parseWhen("Saturday, October 3, 9:00–10:30 a.m.", ISSUE)).toMatchObject({ startTime: "09:00", endTime: "10:30" });
    expect(parseWhen("Saturday, August 29, 12–2 p.m.", ISSUE)).toMatchObject({ startTime: "12:00", endTime: "14:00" });
    expect(parseWhen("Friday, August 28, 10:00 a.m.–noon", ISSUE)).toMatchObject({ startTime: "10:00", endTime: "12:00" });
  });

  it("parses multi-day ranges", () => {
    expect(parseWhen("Saturday–Sunday, October 3–4, 10:00 a.m.–6:00 p.m.", ISSUE)).toMatchObject({
      startDate: "2026-10-03",
      endDate: "2026-10-04",
      startTime: "10:00",
      endTime: "18:00",
    });
    expect(parseWhen("Select nights Friday, September 18–Sunday, September 20", "2026-09-18")).toMatchObject({
      startDate: "2026-09-18",
      endDate: "2026-09-20",
      startTime: null,
    });
  });

  it("resolves a bare weekday against the issue date", () => {
    const parsed = parseWhen("Saturday 8 a.m.–1 p.m.", "2026-09-04");
    expect(parsed).toMatchObject({ startDate: "2026-09-05", startTime: "08:00", endTime: "13:00" });
    expect(parsed?.warnings[0]).toMatch(/relative weekday/);
  });

  it("rolls a year forward for dates far before the issue", () => {
    expect(parseWhen("Saturday, January 9, 10 a.m.", "2026-12-18")?.startDate).toBe("2027-01-09");
  });

  it("flags weekday/date mismatches", () => {
    expect(parseWhen("Sunday, October 3, 10 a.m.", ISSUE)?.warnings[0]).toMatch(/does not match/);
  });

  it("returns null when no specific date is stated", () => {
    expect(parseWhen("Tue–Fri 12–5 p.m.; Sat–Sun 10 a.m.–5 p.m.", ISSUE)).toBeNull();
    expect(parseWhen("Through Sunday, October 4, 2026 (last day) — timed entry", ISSUE)).toBeNull();
    expect(parseWhen("Select nights through November 1, 2026", ISSUE)).toBeNull();
    expect(parseWhen(undefined, ISSUE)).toBeNull();
  });
});
