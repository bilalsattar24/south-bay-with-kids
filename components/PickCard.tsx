import type { ReactNode } from "react";
import { OfficialEventLink } from "@/components/OfficialEventLink";
import { SECTION_LABELS, type EventPick } from "@/lib/issues";

function formatEstimate(pick: EventPick) {
  if (pick.family_of_4_estimate === null) return null;
  if (pick.family_of_4_estimate === 0) return "Free";
  return `$${pick.family_of_4_estimate} for a family of four`;
}

function costKindLabel(pick: EventPick) {
  if (pick.cost_kind === "suggested-donation") return "Suggested donation";
  if (pick.cost_kind === "required") return "Required";
  if (pick.cost_kind === "free") return "Free";
  return null;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

export function PickCard({ pick }: { pick: EventPick }) {
  const estimate = formatEstimate(pick);
  const kind = costKindLabel(pick);
  const showCost = estimate !== null || pick.cost_math || kind;

  return (
    <article className="rounded-2xl border border-line bg-white/70 px-5 py-6">
      <p className="text-xs font-medium tracking-wide text-clay">
        {SECTION_LABELS[pick.section]}
      </p>
      <h3 className="mt-2 font-display text-2xl tracking-tight text-ink">
        <OfficialEventLink
          href={pick.url}
          className="underline decoration-clay/70 underline-offset-[0.18em] hover:text-clay"
        >
          {pick.name}
        </OfficialEventLink>
      </h3>
      <p className="mt-1">
        <OfficialEventLink
          href={pick.url}
          aria-label={`Event page for ${pick.name}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-clay hover:text-clay-deep"
        >
          Event page →
        </OfficialEventLink>
      </p>

      <dl className="mt-5 space-y-4">
        {pick.when ? <Row label="When">{pick.when}</Row> : null}
        {pick.city ? <Row label="City">{pick.city}</Row> : null}
        {pick.address ? <Row label="Address">{pick.address}</Row> : null}
        {showCost ? (
          <Row label="Cost">
            <span className="block">
              {estimate ?? kind}
              {estimate && kind && kind !== "Free" ? (
                <span className="text-ink-soft"> · {kind}</span>
              ) : null}
            </span>
            {pick.cost_math ? (
              <span className="mt-1 block text-ink-soft">{pick.cost_math}</span>
            ) : null}
          </Row>
        ) : null}
        {pick.parking ? <Row label="Parking">{pick.parking}</Row> : null}
        {pick.food ? <Row label="Food">{pick.food}</Row> : null}
        {pick.why ? <Row label="Why">{pick.why}</Row> : null}
        {pick.age_gate ? <Row label="Ages">{pick.age_gate}</Row> : null}
      </dl>
    </article>
  );
}
