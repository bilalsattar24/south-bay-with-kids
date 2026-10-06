import { authenticate, loadKeyConfig } from "./auth";
import { applyEventsQuery, findCredentialParam, parseEventsQuery } from "./query";
import type { TokenBucketLimiter } from "./rate-limit";
import type { EventsDataset } from "./store";

export type EventsHandlerDeps = {
  env: Record<string, string | undefined>;
  now: () => Date;
  limiter: TokenBucketLimiter;
  getDataset: () => EventsDataset;
};

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...headers },
  });
}

function error(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return json(status, { error: { code, message } }, headers);
}

let warnedIgnoredKeys = false;

export function handleEventsRequest(request: Request, deps: EventsHandlerDeps): Response {
  const url = new URL(request.url);

  const credentialParam = findCredentialParam(url.searchParams);
  if (credentialParam) {
    return error(
      400,
      "credentials_in_query",
      `API keys are never accepted in the query string (found \`${credentialParam}\`). ` +
        "Send `Authorization: Bearer <key>` and rotate any key that was put in a URL.",
    );
  }

  const keyConfig = loadKeyConfig(deps.env);
  if (keyConfig.ignored > 0 && !warnedIgnoredKeys) {
    warnedIgnoredKeys = true;
    console.warn(`[events-api] ignored ${keyConfig.ignored} API key(s) shorter than the minimum length`);
  }
  const auth = authenticate(request.headers, keyConfig);
  if (!auth.ok) {
    const headers: Record<string, string> =
      auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="southbaywithkids-events"' } : {};
    return error(auth.status, auth.code, auth.message, headers);
  }

  const rate = deps.limiter.take(auth.keyId, deps.now().getTime());
  const rateHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.resetSeconds),
  };
  if (!rate.allowed) {
    return error(
      429,
      "rate_limited",
      `Rate limit of ${rate.limit} requests per minute exceeded. Retry after ${rate.retryAfterSeconds}s.`,
      { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const parsed = parseEventsQuery(url.searchParams, deps.now());
  if (!parsed.ok) return error(400, parsed.error.code, parsed.error.message, rateHeaders);

  const dataset = deps.getDataset();
  const page = applyEventsQuery(dataset.records, parsed.query);
  return json(
    200,
    {
      last_updated: dataset.lastUpdated,
      from: parsed.query.from,
      to: parsed.query.to,
      events: page.events,
      next_cursor: page.nextCursor,
    },
    rateHeaders,
  );
}
