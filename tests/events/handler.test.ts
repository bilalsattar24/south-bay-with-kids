import { describe, expect, it } from "vitest";
import { extractBearerToken, loadKeyConfig } from "@/lib/events/auth";
import { handleEventsRequest, type EventsHandlerDeps } from "@/lib/events/handler";
import { TokenBucketLimiter } from "@/lib/events/rate-limit";
import { buildEventsDataset } from "@/lib/events/store";
import { issue, pick } from "./fixtures";

const PROD_KEY = "prod_0123456789abcdef0123456789abcdef";
const TEST_KEY = "test_0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-10-06T16:00:00Z");

function deps(overrides: Partial<EventsHandlerDeps> = {}): EventsHandlerDeps {
  return {
    env: { SBWK_API_KEYS: `other_key_that_is_long_enough_123, ${PROD_KEY}`, SBWK_API_TEST_KEYS: TEST_KEY },
    now: () => NOW,
    limiter: new TokenBucketLimiter(60, 60_000),
    getDataset: () => buildEventsDataset([issue("2026-10-02", [pick()])]),
    ...overrides,
  };
}

function request(qs = "", headers: Record<string, string> = { Authorization: `Bearer ${PROD_KEY}` }) {
  return new Request(`https://southbaywithkids.com/api/v1/events${qs}`, { headers });
}

async function body(res: Response) {
  return JSON.parse(await res.text());
}

describe("auth", () => {
  it("extracts bearer tokens strictly", () => {
    expect(extractBearerToken(`Bearer ${PROD_KEY}`)).toBe(PROD_KEY);
    expect(extractBearerToken(`bearer   ${PROD_KEY} `)).toBe(PROD_KEY);
    expect(extractBearerToken(`Basic ${PROD_KEY}`)).toBeNull();
    expect(extractBearerToken("Bearer a b")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("ignores test keys in production and keys that are too short", () => {
    const prod = loadKeyConfig({ SBWK_API_KEYS: `${PROD_KEY},short`, SBWK_API_TEST_KEYS: TEST_KEY, VERCEL_ENV: "production" });
    expect(prod.keys.map((k) => k.kind)).toEqual(["production"]);
    expect(prod.ignored).toBe(1);
    const preview = loadKeyConfig({ SBWK_API_KEYS: PROD_KEY, SBWK_API_TEST_KEYS: TEST_KEY, VERCEL_ENV: "preview" });
    expect(preview.keys.map((k) => k.kind)).toEqual(["production", "test"]);
  });

  it("returns 503 when no keys are configured instead of being open", async () => {
    const res = handleEventsRequest(request(), deps({ env: {} }));
    expect(res.status).toBe(503);
    expect((await body(res)).error.code).toBe("api_not_configured");
  });

  it("returns 401 for a missing, malformed or wrong key", async () => {
    const attempts: Record<string, string>[] = [
      {},
      { Authorization: PROD_KEY },
      { Authorization: "Bearer wrong_key_wrong_key_wrong_key" },
    ];
    for (const headers of attempts) {
      const res = handleEventsRequest(request("", headers), deps());
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
      expect((await body(res)).error.code).toBe("unauthorized");
    }
  });

  it("points X-API-Key users at the Authorization header", async () => {
    const res = handleEventsRequest(request("", { "X-API-Key": PROD_KEY }), deps());
    expect(res.status).toBe(401);
    expect((await body(res)).error.message).toMatch(/Authorization: Bearer/);
  });

  it("rejects keys in the query string even with a valid header", async () => {
    for (const param of ["api_key", "key", "token", "access_token", "API_KEY"]) {
      const res = handleEventsRequest(request(`?${param}=${PROD_KEY}`), deps());
      expect(res.status).toBe(400);
      expect((await body(res)).error.code).toBe("credentials_in_query");
    }
  });

  it("accepts production and (outside production) test keys", () => {
    expect(handleEventsRequest(request(), deps()).status).toBe(200);
    const testReq = request("", { Authorization: `Bearer ${TEST_KEY}` });
    expect(handleEventsRequest(testReq, deps()).status).toBe(200);
    const prodEnv = { SBWK_API_KEYS: PROD_KEY, SBWK_API_TEST_KEYS: TEST_KEY, VERCEL_ENV: "production" };
    expect(handleEventsRequest(request("", { Authorization: `Bearer ${TEST_KEY}` }), deps({ env: prodEnv })).status).toBe(401);
  });
});

describe("GET /api/v1/events", () => {
  it("returns the documented envelope as UTF-8 JSON", async () => {
    const res = handleEventsRequest(request(), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
    const json = await body(res);
    expect(json).toMatchObject({
      last_updated: "2026-10-02T05:00:00-07:00",
      from: "2026-10-05",
      to: "2026-10-11",
      next_cursor: null,
    });
    expect(json.events).toHaveLength(1);
    expect(Object.keys(json.events[0]).sort()).toEqual(
      [
        "address", "age_range", "category", "city", "description", "ends_at", "id", "image_url", "is_free",
        "last_checked_at", "price_text", "source_url", "starts_at", "status", "time_tbd", "title", "venue_name",
        "verified",
      ].sort(),
    );
  });

  it("returns 400 with an error body for invalid parameters", async () => {
    const res = handleEventsRequest(request("?category=nope"), deps());
    expect(res.status).toBe(400);
    expect((await body(res)).error.code).toBe("invalid_parameter");
  });

  it("rate limits each key at 60 requests per minute with Retry-After", async () => {
    let nowMs = NOW.getTime();
    const d = deps({ now: () => new Date(nowMs) });
    for (let i = 0; i < 60; i += 1) expect(handleEventsRequest(request(), d).status).toBe(200);

    const limited = handleEventsRequest(request(), d);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
    expect(limited.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect((await body(limited)).error.code).toBe("rate_limited");

    // Other keys have their own bucket.
    const other = request("", { Authorization: "Bearer other_key_that_is_long_enough_123" });
    expect(handleEventsRequest(other, d).status).toBe(200);

    nowMs += 1000;
    expect(handleEventsRequest(request(), d).status).toBe(200);
  });
});

describe("TokenBucketLimiter", () => {
  it("refills continuously up to the limit", () => {
    const limiter = new TokenBucketLimiter(3, 3000);
    expect([0, 0, 0, 0].map(() => limiter.take("k", 0).allowed)).toEqual([true, true, true, false]);
    expect(limiter.take("k", 500)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.take("k", 1000).allowed).toBe(true);
    expect(limiter.take("k", 60_000)).toMatchObject({ allowed: true, remaining: 2 });
  });
});
