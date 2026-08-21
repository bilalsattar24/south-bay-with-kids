const beats = [
  {
    title: "This weekend",
    body: "A short list of what is actually happening nearby — parks, markets, and the stuff that fits a nap schedule.",
  },
  {
    title: "Worth the drive",
    body: "One outing within about an hour when it is worth leaving the South Bay. Skip it if the week is already full.",
  },
  {
    title: "Free this week",
    body: "Library hours, city rec, and the free things that do not need a reservation or a cooler full of snacks.",
  },
];

export function WhatYouGet() {
  return (
    <section className="border-t border-line/80 bg-paper-deep/40">
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-6 sm:py-16">
        <h2 className="font-display text-3xl tracking-tight text-ink">
          What you get
        </h2>
        <p className="mt-2 text-ink-soft">Three short beats. That is the letter.</p>
        <ol className="mt-8 space-y-8">
          {beats.map((beat, index) => (
            <li key={beat.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay text-sm font-medium text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-display text-xl text-ink">{beat.title}</h3>
                <p className="mt-1 leading-relaxed text-ink-soft">{beat.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
