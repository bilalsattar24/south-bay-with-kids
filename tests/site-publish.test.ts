import { describe, expect, it, vi } from "vitest";
import {
  emitPublishReport,
  reportPublished,
  SitePublishError,
} from "@/lib/site-publish";

const url =
  "https://www.southbaywithkids.com/issues/2026-10-30-mall-o-ween-harbor-haunts-dia-de-muertos";

function http(status: number): Response {
  return new Response("body", { status });
}

describe("reportPublished", () => {
  it("returns the published line only after the issue URL returns HTTP 200", async () => {
    const line = await reportPublished(
      { emailSent: true, issueUrl: url },
      async () => http(200),
    );
    expect(line).toBe(`published: ${url} HTTP 200`);
  });

  it("fails when the email sent but the issue URL is not HTTP 200", async () => {
    await expect(
      reportPublished({ emailSent: true, issueUrl: url }, async () => http(404)),
    ).rejects.toThrow(SitePublishError);

    await expect(
      reportPublished({ emailSent: true, issueUrl: url }, async () => http(404)),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("fails when the site cannot be fetched, even if the email sent", async () => {
    await expect(
      reportPublished({ emailSent: true, issueUrl: url }, async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toThrow(/site-publish failed:.*Email sent: true/);
  });
});

describe("emitPublishReport", () => {
  it("logs the published line only when it records HTTP 200", () => {
    const log = vi.fn();
    emitPublishReport(`published: ${url} HTTP 200`, log);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toBe(`published: ${url} HTTP 200`);
  });

  it("does not log when the line is an email-only success or a non-200", () => {
    const log = vi.fn();
    expect(() => emitPublishReport("email sent", log)).toThrow(SitePublishError);
    expect(() => emitPublishReport(`published: ${url} HTTP 404`, log)).toThrow(
      /without a verified HTTP 200/,
    );
    expect(log).not.toHaveBeenCalled();
  });
});
