# Issues

Friday letters live here as JSON. The homepage, `/archive`, and `/issues/[slug]` read this folder. Markdown files (including this README) are not issues.

Filename:

```
yyyy-mm-dd-slug.json
```

Example: `2026-08-22-last-rpv-concert-sunday-book-festival.json`

Required fields: `date`, `title`, `intro`, `picks`.

Each pick needs `name`, `url` (official page only), `section`, and `family_of_4_estimate` (`number` or `null`). Optional rows — `when`, `city`, `address`, `cost_math`, `cost_kind`, `parking`, `food`, `why`, `age_gate` — are omitted on the public page when blank.

`section` is one of: `this-weekend`, `coming-up`, `free-this-week`, `watch`.

`cost_kind` is one of: `free`, `required`, `suggested-donation`.

`family_of_4_estimate` is required fees only (entry + parking + required fees for 2 adults + 2 kids). Never invent prices. Use `null` when parking or another required piece is unknown. “Free entry, parking unknown” is a valid `cost_math`.

## Events API fields

The Events API (`/api/v1/events`) reads these optional fields. The public pages ignore them. A missing key means "derive it from the free text"; an explicit `null` means "known to be unknown, don't derive". After adding an issue, run `npm run events:backfill`: it fills only missing keys, then you review the diff.

Issue level:

- `last_checked_at`: ISO 8601 with offset; when this issue's events were last fact-checked. The backfill uses the issue file's last git commit time.

Per pick:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable `evt_…` id. Never change it once set, even if the event is edited. Copy it onto later listings of the same occurrence if their URL and title both differ. |
| `starts_at` / `ends_at` | ISO 8601 with LA offset, or `null` | `starts_at: null` = no specific date; not served by the API. |
| `time_tbd` | boolean | Date known, start time not; `starts_at` is local midnight. |
| `venue_name` | string or `null` | e.g. "Madrona Marsh Nature Center". |
| `street_address` | string or `null` | Clean street address only ("3201 Plaza del Amo"). |
| `price_text` | string or `null` | Short price from an official page ("$10 adults, $8 ages 2–17"). `null` when free or unknown. Never guess. |
| `image_url` | string or `null` | Official event image. |
| `is_free` | boolean | Override; default comes from `cost_kind` (`free`/`suggested-donation` → true). |
| `category` | `this_weekend` \| `worth_the_drive` \| `free_this_week` | Override; default comes from `section` + city (see the main README). |
| `description` | string | Override for the API description; default is `why`. Plain text. |
| `status` | `scheduled` \| `cancelled` | Mark cancellations here instead of deleting the pick. |
| `verified` | boolean | `true` only when details were confirmed on an official page. |
| `last_checked_at` | ISO 8601 with offset | Per-pick override of the issue-level value. |
