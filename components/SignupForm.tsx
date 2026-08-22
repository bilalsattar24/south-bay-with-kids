"use client";

import Script from "next/script";
import { useLayoutEffect, useRef } from "react";

const BEEHIIV_FORM_ID = "79e8c1ec-daf4-4a78-918f-c5aa238e2422";
const BEEHIIV_LOADER_SRC =
  "https://subscribe-forms.beehiiv.com/v3/loader.js";
const BEEHIIV_SUBSCRIBE_URL =
  "https://south-bay-with-kids.beehiiv.com/subscribe";

export function SignupForm() {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Beehiiv inserts the iframe next to this tag. next/script appends to
    // document.body, so the form-id script has to live in the homepage slot.
    const script = document.createElement("script");
    script.src = BEEHIIV_LOADER_SRC;
    script.async = true;
    script.setAttribute("data-beehiiv-form", BEEHIIV_FORM_ID);
    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, []);

  return (
    <div>
      <div ref={hostRef} className="min-h-14" />
      <Script src={BEEHIIV_LOADER_SRC} strategy="afterInteractive" />
      <noscript>
        <a
          href={BEEHIIV_SUBSCRIBE_URL}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-clay px-5 text-base font-medium text-white hover:bg-clay-deep focus:outline-none focus:ring-2 focus:ring-clay/40 focus:ring-offset-2 focus:ring-offset-paper"
        >
          Get the Friday letter
        </a>
      </noscript>
    </div>
  );
}
