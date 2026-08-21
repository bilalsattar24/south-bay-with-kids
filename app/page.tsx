import { LatestIssue } from "@/components/LatestIssue";
import { SignupForm } from "@/components/SignupForm";
import { WhatYouGet } from "@/components/WhatYouGet";

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -top-16 -left-10 h-56 w-56 rounded-full bg-clay-soft/70" />
          <div className="absolute top-10 right-[-3rem] h-40 w-40 rounded-full bg-paper-deep" />
          <div className="absolute bottom-0 left-1/3 h-24 w-72 rounded-full bg-clay/10 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <p className="text-sm font-medium tracking-wide text-clay">
            A free Friday letter
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            South Bay with Kids
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Friday finds for parents in the South Bay (Torrance and nearby, plus
            outings within about an hour).
          </p>
          <div className="mt-8">
            <SignupForm />
          </div>
        </div>
      </section>

      <WhatYouGet />
      <LatestIssue />
    </main>
  );
}
