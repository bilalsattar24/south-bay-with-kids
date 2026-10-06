import { describe, expect, it } from "vitest";
import { cleanCity, derivePick, mapCategory, splitAddress, toPlainText } from "@/lib/events/derive";
import { buildEventsDataset, computeEventId } from "@/lib/events/store";
import { issue, pick } from "./fixtures";

describe("toPlainText", () => {
  it("strips tags, scripts and entities", () => {
    expect(toPlainText("<p>Free <b>turtles</b> &amp; tortoises&nbsp;today</p><script>alert(1)</script>")).toBe(
      "Free turtles & tortoises today",
    );
    expect(toPlainText("&lt;img src=x onerror=alert(1)&gt; hi")).toBe("hi");
    expect(toPlainText("Caf&#233; &#x2014; open")).toBe("Café — open");
  });
});

describe("location helpers", () => {
  it("splits venue and street address and drops notes", () => {
    expect(splitAddress("South Coast Botanic Garden, 26300 Crenshaw Blvd (use this address — apps may misroute)")).toEqual({
      venue: "South Coast Botanic Garden",
      street: "26300 Crenshaw Blvd",
    });
    expect(splitAddress("1317 Sartori Avenue")).toEqual({ venue: null, street: "1317 Sartori Avenue" });
    expect(splitAddress("Old Torrance — Discover Torrance lists 1313 Sartori Ave")).toEqual({
      venue: "Old Torrance",
      street: null,
    });
    expect(splitAddress(undefined)).toEqual({ venue: null, street: null });
  });

  it("cleans parenthetical notes from cities", () => {
    expect(cleanCity("Torrance (choose Torrance store when registering)")).toBe("Torrance");
    expect(cleanCity(undefined)).toBeNull();
  });
});

describe("mapCategory", () => {
  const base = { city: "Torrance", startDate: "2026-10-10", isFree: true };
  it("maps newsletter sections to API categories", () => {
    expect(mapCategory({ ...base, section: "this-weekend" })).toBe("this_weekend");
    expect(mapCategory({ ...base, section: "free-this-week" })).toBe("free_this_week");
    expect(mapCategory({ ...base, section: "coming-up" })).toBe("this_weekend");
    expect(mapCategory({ ...base, section: "watch", startDate: "2026-10-06" })).toBe("free_this_week");
    expect(mapCategory({ ...base, section: "watch", startDate: "2026-10-06", isFree: false })).toBe("this_weekend");
  });

  it("sends events outside the South Bay to worth_the_drive", () => {
    expect(mapCategory({ ...base, section: "this-weekend", city: "Long Beach" })).toBe("worth_the_drive");
    expect(mapCategory({ ...base, section: "coming-up", city: "Rancho Palos Verdes / Rolling Hills Estates" })).toBe(
      "this_weekend",
    );
    // An explicit "free this week" pick keeps that beat even if it's a drive.
    expect(mapCategory({ ...base, section: "free-this-week", city: "Long Beach" })).toBe("free_this_week");
  });
});

describe("derivePick", () => {
  it("derives the API event from free-text fields", () => {
    const result = derivePick(pick({ age_gate: "Ages 3–6 with a parent." }), issue("2026-10-02", []));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.event).toMatchObject({
      title: "Turtle and Tortoise Day",
      starts_at: "2026-10-10T10:00:00-07:00",
      ends_at: "2026-10-10T16:00:00-07:00",
      time_tbd: false,
      venue_name: "Madrona Marsh Nature Center",
      address: "3201 Plaza del Amo",
      city: "Torrance",
      is_free: true,
      price_text: null,
      age_range: "Ages 3–6 with a parent",
      category: "this_weekend",
      status: "scheduled",
      verified: false,
      last_checked_at: "2026-10-02T05:00:00-07:00",
      image_url: null,
    });
  });

  it("prefers stored structured fields over derived ones", () => {
    const result = derivePick(
      pick({
        starts_at: "2026-10-10T11:00:00-07:00",
        ends_at: null,
        venue_name: "Nature Center lawn",
        street_address: null,
        category: "worth_the_drive",
        status: "cancelled",
        verified: true,
        description: "<em>Moved</em> indoors.",
      }),
      issue("2026-10-02", []),
    );
    expect(result.ok && result.record.event).toMatchObject({
      starts_at: "2026-10-10T11:00:00-07:00",
      ends_at: null,
      venue_name: "Nature Center lawn",
      address: null,
      category: "worth_the_drive",
      status: "cancelled",
      verified: true,
      description: "Moved indoors.",
    });
  });

  it("marks date-only events as time_tbd", () => {
    const result = derivePick(pick({ when: "Sunday, October 18, 2026" }), issue("2026-10-02", []));
    expect(result.ok && result.record.event).toMatchObject({
      starts_at: "2026-10-18T00:00:00-07:00",
      time_tbd: true,
    });
  });

  it("skips picks without a usable start or city", () => {
    expect(derivePick(pick({ starts_at: null }), issue("2026-10-02", []))).toEqual({
      ok: false,
      reason: "no specific start date",
    });
    expect(derivePick(pick({ when: "Tue–Fri 12–5 p.m." }), issue("2026-10-02", [])).ok).toBe(false);
    expect(derivePick(pick({ city: undefined }), issue("2026-10-02", []))).toEqual({ ok: false, reason: "no city" });
  });
});

describe("buildEventsDataset", () => {
  it("computes deterministic ids from URL + start date", () => {
    const ds = buildEventsDataset([issue("2026-10-02", [pick()])]);
    const id = computeEventId(pick().url, "2026-10-10");
    expect(ds.records[0].event.id).toBe(id);
    expect(id).toMatch(/^evt_[0-9a-f]{16}$/);
    // Trailing slash / www / fragment don't change the id.
    expect(computeEventId("https://friendsofmadronamarsh.com/events/turtle-and-tortoise-day#x", "2026-10-10")).toBe(id);
  });

  it("keeps a stored id even after the event is edited", () => {
    const original = buildEventsDataset([issue("2026-10-02", [pick({ id: "evt_fixed" })])]);
    const edited = buildEventsDataset([
      issue("2026-10-02", [
        pick({
          id: "evt_fixed",
          name: "Turtle & Tortoise Day (rescheduled)",
          url: "https://example.org/new-page",
          when: "Sunday, October 11, 1 p.m.",
        }),
      ]),
    ]);
    expect(original.records[0].event.id).toBe("evt_fixed");
    expect(edited.records[0].event.id).toBe("evt_fixed");
    expect(edited.records[0].event.starts_at).toBe("2026-10-11T13:00:00-07:00");
  });

  it("dedupes across issues and keeps the most recent listing", () => {
    const older = issue("2026-09-25", [pick({ section: "watch", why: "Old blurb", verified: false })]);
    const newer = issue("2026-10-02", [pick({ why: "New blurb", verified: true })]);
    const ds = buildEventsDataset([newer, older]);
    expect(ds.records).toHaveLength(1);
    expect(ds.records[0].event).toMatchObject({ description: "New blurb", verified: true });
    expect(ds.records[0].issueSlug).toBe(newer.slug);
  });

  it("links a later listing with a different URL to a stored id via its title", () => {
    const older = issue("2026-09-25", [pick({ id: "evt_stored", url: "https://example.org/calendar" })]);
    const newer = issue("2026-10-02", [pick({ name: "Turtle and Tortoise Day!" })]);
    const ds = buildEventsDataset([older, newer]);
    expect(ds.records.map((r) => r.event.id)).toEqual(["evt_stored"]);
    expect(ds.records[0].event.source_url).toBe(pick().url);
  });

  it("keeps separate occurrences of a recurring event", () => {
    const ds = buildEventsDataset([
      issue("2026-10-02", [
        pick({ when: "Saturday, October 10, 10 a.m." }),
        pick({ when: "Saturday, October 17, 10 a.m." }),
      ]),
    ]);
    expect(new Set(ds.records.map((r) => r.event.id)).size).toBe(2);
  });

  it("reports skipped picks and the latest check time", () => {
    const ds = buildEventsDataset([
      issue("2026-09-25", [pick()]),
      issue("2026-10-02", [pick({ name: "Ongoing", when: "Through Sunday, October 4" })], {
        last_checked_at: "2026-10-02T05:04:36-07:00",
      }),
    ]);
    expect(ds.skipped).toEqual([{ issueSlug: "2026-10-02-test", title: "Ongoing", reason: "no specific start date" }]);
    expect(ds.lastUpdated).toBe("2026-09-25T05:00:00-07:00");
  });
});
