# South Bay with Kids

Friday finds for parents in the South Bay (Torrance and nearby, plus outings within about an hour).

## Local

```bash
npm install
npm run dev
```

Open http://localhost:3000

```bash
npm test          # unit tests (vitest)
npm run lint
npm run build
```

## Deploy

Import this folder as a new Vercel project. Next.js is detected automatically.

Issues live in content/issues/ as yyyy-mm-dd-slug.json. The homepage, /archive, and /issues/[slug] read that folder. Markdown files there (including the README) are not issues.

## Events API (v1)

Read-only JSON feed of the newsletter's events for the Instagram pipeline and other consumers.

- Endpoint: `GET https://southbaywithkids.com/api/v1/events`
- Spec: [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.1); requirements in [`docs/events-api-v1-requirements.md`](docs/events-api-v1-requirements.md)
- Code: `app/api/v1/events/route.ts` → `lib/events/`

### Auth

Send the key in the `Authorization` header:

```
Authorization: Bearer <key>
```

That is the only accepted form. `X-API-Key` returns 401 with a hint, and any key-like query parameter (`api_key`, `key`, `token`, `access_token`, `apikey`, `auth`) is rejected with `400 credentials_in_query`, even if the header is valid. Keys are compared as SHA-256 digests with `crypto.timingSafeEqual`, checking every configured key without exiting early. If no keys are configured, the endpoint returns `503 api_not_configured`; it never falls back to being open.

### Vercel environment variables

| Variable | Set in | Value |
|---|---|---|
| `SBWK_API_KEYS` | Production (and Preview if you want prod keys to work there) | Comma-separated production keys |
| `SBWK_API_TEST_KEYS` | Preview + Development | Comma-separated staging/test keys. Ignored when `VERCEL_ENV=production`, even if set there by mistake. |

Generate each key with `openssl rand -hex 32`. Keys shorter than 24 characters are ignored, and a warning is logged. To rotate a key, add the new one to the list, redeploy, move the consumer over, then remove the old key and redeploy. Env var changes only apply to new deployments.

### Query parameters

| Param | Default | Notes |
|---|---|---|
| `from` | Monday of the current week (LA) | `YYYY-MM-DD`. If only `to` is given, the Monday of `to`'s week. |
| `to` | Sunday of the current week (LA) | Inclusive. If only `from` is given, the Sunday of `from`'s week. Max range 366 days. |
| `category` | all | `this_weekend`, `worth_the_drive`, `free_this_week` |
| `limit` | 50 | 1–200; larger values are clamped to 200. |
| `cursor` | none | `next_cursor` from the previous page. Must be used with the same filters (`limit` may change). |
| `include_cancelled` | `false` | `true`/`false` |

An event is returned if it overlaps `[from 00:00, to 24:00)` LA time, so multi-day events show up on each day they span. Results are sorted by `starts_at` ascending, with `id` as the tiebreaker. Pagination is keyset-based, so pages don't shift when data changes between calls. Invalid parameters return `400` with `{"error": {"code", "message"}}`.

### Rate limiting

60 requests per minute per key: a token bucket that refills continuously and allows bursts of up to 60. Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds until the bucket is full). Over the limit you get `429 rate_limited` with `Retry-After` (seconds).

The limiter is in memory per server instance, so it's best-effort. On Vercel each concurrently running function instance has its own buckets, and a cold start resets them. That's fine for a handful of trusted keys. If strict global limits are needed, move the buckets to a shared store (for example Upstash Redis from the Vercel Marketplace).

### Example

```bash
curl -s "https://southbaywithkids.com/api/v1/events?from=2026-10-05&to=2026-10-11&limit=2" \
  -H "Authorization: Bearer $SBWK_API_KEY"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: private, no-store
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1
```

```json
{
  "last_updated": "2026-10-05T15:03:43-07:00",
  "from": "2026-10-05",
  "to": "2026-10-11",
  "events": [
    {
      "id": "evt_f2b12c92f06dfb3a",
      "title": "Cephalopod Awareness Week (drop-in)",
      "starts_at": "2026-10-06T00:00:00-07:00",
      "ends_at": "2026-10-10T17:00:00-07:00",
      "time_tbd": true,
      "venue_name": "Cabrillo Marine Aquarium Exhibit Hall",
      "address": "3720 Stephen M. White Drive",
      "city": "San Pedro",
      "is_free": true,
      "price_text": "Suggested donation $10 adult, $5 child (not required)",
      "age_range": null,
      "description": "Interactive cephalopod learning during regular visit hours — last days this week.",
      "category": "free_this_week",
      "source_url": "https://cma.recreation.parks.lacity.gov/events/public-programs",
      "image_url": null,
      "status": "scheduled",
      "verified": true,
      "last_checked_at": "2026-10-05T15:03:43-07:00"
    },
    {
      "id": "evt_fc07d861fbadb396",
      "title": "Magic of the Jack O'Lanterns",
      "starts_at": "2026-10-08T00:00:00-07:00",
      "ends_at": "2026-10-11T23:59:59-07:00",
      "time_tbd": true,
      "venue_name": "South Coast Botanic Garden",
      "address": "26300 Crenshaw Blvd",
      "city": "Palos Verdes Peninsula",
      "is_free": false,
      "price_text": null,
      "age_range": null,
      "description": "Lit pumpkin trail plus family Fun Zone. Open this midweek stretch and the weekend — check which nights remain.",
      "category": "this_weekend",
      "source_url": "https://magicofthejackolanterns.com/la/",
      "image_url": null,
      "status": "scheduled",
      "verified": true,
      "last_checked_at": "2026-10-05T15:03:43-07:00"
    }
  ],
  "next_cursor": "eyJ2IjoxLCJzIjoxNzkxNDQyODAwMDAwLCJpIjoiZXZ0X2ZjMDdkODYxZmJhZGIzOTYiLCJxIjoidm5UNno4bkVwTXNfIn0"
}
```

Fetch the next page with `...&limit=2&cursor=<next_cursor>`. Errors look like:

```json
{ "error": { "code": "rate_limited", "message": "Rate limit of 60 requests per minute exceeded. Retry after 1s." } }
```

### Where the data comes from

Each pick in `content/issues/*.json` is one event occurrence. The API reads optional structured fields on each pick (see `content/issues/README.md`). When a field is missing, the API derives it from the newsletter's free text:

- `starts_at`/`ends_at` are parsed from `when` (first date and first time range, ignoring parentheticals). If there's a date but no time, the event gets local midnight plus `time_tbd: true` (an additive field beyond the spec). Picks with no specific date (opening hours, "through Sunday", "select nights through Nov 1") are not served.
- `venue_name`/`address` are split from `address` ("Venue, 123 Street (note)"). With no venue name, `venue_name` falls back to the street address, then the city.
- `is_free` is true when `cost_kind` is `free` or `suggested-donation`. `price_text` is only taken from the stored field and is forced to null for `free` events.
- `description` is `description` if set, otherwise `why`, with HTML stripped.
- `last_checked_at` is the pick's own field, else the issue-level field, else the issue date.
- `verified` and `status` default to `false` and `scheduled`.

**Category mapping.** A pick's explicit `category` always wins. Otherwise the rules apply in this order:

1. Section `free-this-week` → `free_this_week`.
2. City outside the South Bay → `worth_the_drive`. The South Bay list is in `SOUTH_BAY_CITIES` in `lib/events/derive.ts`: Torrance, Redondo/Hermosa/Manhattan Beach, El Segundo, the Palos Verdes cities, San Pedro, Carson, Gardena, Lomita, etc. Long Beach, Downey, West Hollywood and central LA count as outside.
3. Section `this-weekend` → `this_weekend`.
4. Sections `coming-up` and `watch`: a free event starting Monday–Thursday → `free_this_week`; anything else → `this_weekend`.

**Ids and dedupe.** Each servable pick stores an explicit `id`, so editing a title, URL or time never changes it. For picks without one, the API reuses the id of any event with the same official URL, or the same normalized title, on the same LA start date. Failing that, it computes `evt_` + the first 16 hex characters of `sha256(normalized URL | start date)`. The same event often appears in several issues (for example as "coming up", then "this weekend"); when several picks share an id, the most recent issue's copy is served. Recurring events (a weekly storytime) are separate occurrences with separate ids. `last_updated` is the newest `last_checked_at` across all events.

**Adding a new issue.** After writing `content/issues/<slug>.json`, run `npm run events:backfill` and review the diff. It only fills in missing keys, never overwrites. If any served pick lacks a stored id, `npm test` fails. Set `verified`, `price_text`, `image_url` and `status: "cancelled"` directly in the JSON when known.

The issue JSON is bundled with the deployment (`outputFileTracingIncludes` in `next.config.ts`) and parsed once per server instance. A default-week request does no I/O, typically a few milliseconds.
