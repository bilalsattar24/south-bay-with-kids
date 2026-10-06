import { describe, expect, it } from "vitest";
import { API_CATEGORIES } from "@/lib/events/derive";
import { deriveAllPicks, buildEventsDataset } from "@/lib/events/store";
import { getIssues } from "@/lib/issues";

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

describe("content/issues as served by the events API", () => {
  const issues = getIssues();
  const dataset = buildEventsDataset(issues);

  it("serves events with every required field in the documented shape", () => {
    expect(dataset.records.length).toBeGreaterThan(0);
    for (const { event } of dataset.records) {
      expect(event.id).toMatch(/^evt_[0-9a-f]{16}$/);
      expect(event.title).not.toBe("");
      expect(event.starts_at).toMatch(ISO_WITH_OFFSET);
      if (event.ends_at) {
        expect(event.ends_at).toMatch(ISO_WITH_OFFSET);
        expect(Date.parse(event.ends_at)).toBeGreaterThan(Date.parse(event.starts_at));
      }
      expect(event.last_checked_at).toMatch(ISO_WITH_OFFSET);
      expect(event.venue_name).not.toBe("");
      expect(event.city).not.toBe("");
      expect(event.description).not.toMatch(/[<>]/);
      expect(API_CATEGORIES).toContain(event.category);
      expect(["scheduled", "cancelled"]).toContain(event.status);
      expect(event.source_url).toMatch(/^https?:\/\//);
      if (event.is_free && event.price_text) expect(event.price_text).toMatch(/donation|fee/i);
    }
  });

  it("has a stored id on every servable pick so ids never drift (run `npm run events:backfill`)", () => {
    const missing = deriveAllPicks(issues)
      .filter((d) => d.record && !d.record.storedId)
      .map((d) => `${d.issue.slug}: ${d.pick.name}`);
    expect(missing).toEqual([]);
  });
});
