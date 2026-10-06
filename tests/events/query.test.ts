import { describe, expect, it } from "vitest";
import { applyEventsQuery, parseEventsQuery, type EventsQuery } from "@/lib/events/query";
import { buildEventsDataset } from "@/lib/events/store";
import { issue, pick } from "./fixtures";

const NOW = new Date("2026-10-06T16:00:00Z"); // Tuesday Oct 6, 9 a.m. LA

function parse(qs: string, now = NOW): EventsQuery {
  const result = parseEventsQuery(new URLSearchParams(qs), now);
  if (!result.ok) throw new Error(result.error.message);
  return result.query;
}

function parseError(qs: string) {
  const result = parseEventsQuery(new URLSearchParams(qs), NOW);
  if (result.ok) throw new Error(`expected an error for ${qs}`);
  return result.error;
}

describe("parseEventsQuery", () => {
  it("defaults to Monday–Sunday of the current LA week", () => {
    expect(parse("")).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-11",
      category: null,
      limit: 50,
      includeCancelled: false,
      cursor: null,
    });
  });

  it("fills the missing end of a half-open range with that week", () => {
    expect(parse("from=2026-10-14")).toMatchObject({ from: "2026-10-14", to: "2026-10-18" });
    expect(parse("to=2026-10-14")).toMatchObject({ from: "2026-10-12", to: "2026-10-14" });
  });

  it("validates parameters", () => {
    expect(parseError("from=2026-13-01").code).toBe("invalid_parameter");
    expect(parseError("from=10/05/2026").code).toBe("invalid_parameter");
    expect(parseError("from=2026-10-10&to=2026-10-01").message).toMatch(/on or before/);
    expect(parseError("from=2026-01-01&to=2027-06-01").message).toMatch(/366/);
    expect(parseError("category=weekend").message).toMatch(/this_weekend/);
    expect(parseError("limit=0").code).toBe("invalid_parameter");
    expect(parseError("limit=abc").code).toBe("invalid_parameter");
    expect(parseError("include_cancelled=yes").code).toBe("invalid_parameter");
    expect(parseError("limit=5&limit=6").message).toMatch(/only be given once/);
    expect(parseError("cursor=not-a-cursor").code).toBe("invalid_cursor");
  });

  it("clamps limit to 200", () => {
    expect(parse("limit=500").limit).toBe(200);
    expect(parse("limit=7").limit).toBe(7);
  });

  it("parses include_cancelled", () => {
    expect(parse("include_cancelled=true").includeCancelled).toBe(true);
    expect(parse("include_cancelled=0").includeCancelled).toBe(false);
  });
});

describe("applyEventsQuery", () => {
  const dataset = buildEventsDataset([
    issue("2026-10-02", [
      pick({ name: "Sunday thing", when: "Sunday, October 11, 9 a.m." }),
      pick({ name: "Weekend fair", url: "https://example.org/fair", when: "Saturday–Sunday, October 10–11, 10 a.m.–6 p.m." }),
      pick({ name: "Drive", url: "https://example.org/lb", city: "Long Beach", when: "Saturday, October 10, 9 a.m." }),
      pick({ name: "Freebie", url: "https://example.org/free", section: "free-this-week", when: "Tuesday, October 6, 10 a.m." }),
      pick({ name: "Cancelled", url: "https://example.org/x", when: "Friday, October 9, 6 p.m.", status: "cancelled" }),
      pick({ name: "Spans in", url: "https://example.org/span", when: "Friday–Monday, October 2–5, 10 a.m.–4 p.m." }),
      pick({ name: "Next week", url: "https://example.org/later", when: "Saturday, October 17, 9 a.m." }),
    ]),
  ]);

  it("filters to the range, sorts by starts_at and hides cancelled events", () => {
    const { events, nextCursor } = applyEventsQuery(dataset.records, parse(""));
    expect(events.map((e) => e.title)).toEqual(["Spans in", "Freebie", "Drive", "Weekend fair", "Sunday thing"]);
    expect(nextCursor).toBeNull();
  });

  it("includes cancelled events on request", () => {
    const { events } = applyEventsQuery(dataset.records, parse("include_cancelled=true"));
    expect(events.map((e) => e.title)).toContain("Cancelled");
    expect(events.find((e) => e.title === "Cancelled")?.status).toBe("cancelled");
  });

  it("filters by category", () => {
    const titles = (category: string) =>
      applyEventsQuery(dataset.records, parse(`category=${category}`)).events.map((e) => e.title);
    expect(titles("worth_the_drive")).toEqual(["Drive"]);
    expect(titles("free_this_week")).toEqual(["Freebie"]);
    expect(titles("this_weekend")).toEqual(["Spans in", "Weekend fair", "Sunday thing"]);
  });

  it("paginates with a cursor until exhausted, without gaps or repeats", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query = parse(`limit=2${cursor ? `&cursor=${cursor}` : ""}`);
      const page = applyEventsQuery(dataset.records, query);
      seen.push(...page.events.map((e) => e.title));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual(["Spans in", "Freebie", "Drive", "Weekend fair", "Sunday thing"]);
  });

  it("rejects a cursor reused with different filters", () => {
    const first = applyEventsQuery(dataset.records, parse("limit=1"));
    expect(first.nextCursor).not.toBeNull();
    const result = parseEventsQuery(
      new URLSearchParams(`limit=1&category=this_weekend&cursor=${first.nextCursor}`),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_cursor");
    // Changing only the page size is fine.
    expect(parseEventsQuery(new URLSearchParams(`limit=3&cursor=${first.nextCursor}`), NOW).ok).toBe(true);
  });
});
