# South Bay with Kids — Events API Requirements (v1)

## Goal
Expose the kid-friendly event data the newsletter bot already collects, so an Instagram content pipeline (and future consumers) can pull the current week's events and turn them into posts.

## Base
- Base URL: `https://southbaywithkids.com/api/v1`
- HTTPS only. All responses JSON, UTF-8, `Content-Type: application/json`.

## Authentication
- API key sent in the `Authorization: Bearer <key>` header (or `X-API-Key` — pick one and document it).
- Key issued out-of-band. Never accept keys in query strings.

## Endpoints

### `GET /events`
List events in a date range. This is the only endpoint needed for v1.

Query parameters:
- `from` (YYYY-MM-DD) — range start. Default: Monday of the current week.
- `to` (YYYY-MM-DD) — range end. Default: Sunday of the current week.
- `category` — filter by newsletter beat: `this_weekend`, `worth_the_drive`, `free_this_week`. Optional.
- `limit` — default 50, max 200.
- `cursor` — pagination cursor. Optional.
- `include_cancelled` — default `false`.

Response:
```json
{
  "last_updated": "2026-10-05T18:00:00-07:00",
  "events": [ { "id": "evt_123", "...": "..." } ],
  "next_cursor": null
}
```

### Event object
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable unique ID. Must not change between calls — the pipeline dedupes on this. |
| `title` | string | yes | Event name, plain text. |
| `starts_at` | string | yes | ISO 8601 with timezone offset. |
| `ends_at` | string | no | ISO 8601 with timezone offset. |
| `venue_name` | string | yes | |
| `address` | string | no | Street address, if known. |
| `city` | string | yes | e.g. "Torrance". |
| `is_free` | boolean | yes | |
| `price_text` | string/null | no | e.g. "$5/person". Null when free or unknown. |
| `age_range` | string | no | e.g. "Ages 3–10", "All ages". |
| `description` | string | yes | 1–2 sentences, plain text, no HTML. |
| `category` | string | yes | One of `this_weekend`, `worth_the_drive`, `free_this_week`. |
| `source_url` | string | yes | Official event page URL. |
| `image_url` | string/null | no | Event image, if available. |
| `status` | string | yes | `scheduled` or `cancelled`. |
| `verified` | boolean | yes | Whether the bot confirmed details on an official page. |
| `last_checked_at` | string | yes | ISO 8601 timestamp of the bot's last verification. |

### Rules
- Sort by `starts_at` ascending.
- Exclude `status=cancelled` unless `include_cancelled=true`.
- Updates to an event keep the same `id`.
- All times in `America/Los_Angeles`, always with the UTC offset included.
- `description` must be plain text (no HTML tags).

## Reliability & ops
- p95 response under 1s for the default week query.
- Rate limiting documented (e.g. 60 req/min), with `429` + `Retry-After` when exceeded.
- Versioned path (`/v1`); breaking changes ship as `/v2`, never silently.
- Provide an OpenAPI spec or a short README with a full example request/response.
- Issue a separate staging/test key for development.

## Out of scope for v1
- Write endpoints, webhooks, subscriber/newsletter data. Read-only events feed only.
