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
