import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "A free Friday letter for parents in the South Bay and nearby — local finds, plus the occasional outing worth the drive.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium tracking-wide text-clay">About</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">
        Written from here
      </h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-soft">
        <p>
          South Bay with Kids is a local parent newsletter — the kind of Friday
          note you want after a long week, not another feed to scroll. It is
          written for families in Torrance and the nearby South Bay, with the
          occasional outing that is worth about an hour in the car.
        </p>
        <p>
          It is free. It lands on Fridays. This site is the front porch: a
          place to read the letter, look back through past issues, and sign
          up when you are ready.
        </p>
      </div>
    </main>
  );
}
