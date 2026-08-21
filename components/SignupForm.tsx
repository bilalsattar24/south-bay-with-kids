"use client";

import { FormEvent, useState } from "react";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-line bg-paper-deep px-5 py-4 text-ink"
      >
        You&apos;re on the list — we&apos;ll hook this to the Friday letter soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <div className="min-w-0 flex-1">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-soft/70 focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/30"
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-clay px-5 text-base font-medium text-white hover:bg-clay-deep focus:outline-none focus:ring-2 focus:ring-clay/40 focus:ring-offset-2 focus:ring-offset-paper"
      >
        Get the Friday letter
      </button>
    </form>
  );
}
