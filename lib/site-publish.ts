/**
 * Site publish is not done when the email goes out. Issue pages are static,
 * so they exist only after a deploy, and only a live HTTP 200 counts.
 *
 * `reportPublished` never returns a success line unless that check passes.
 * `emitPublishReport` is the only place that logs it.
 */

export class SitePublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SitePublishError";
  }
}

export type PublishReportInput = {
  /** Recorded so a failure still says the email went out. It does not count as success. */
  emailSent: boolean;
  issueUrl: string;
};

const PUBLISHED_LINE = /^published: https?:\/\/\S+ HTTP 200$/;

export function issueUrlForSlug(slug: string, origin = "https://www.southbaywithkids.com") {
  return `${origin}/issues/${slug}`;
}

/**
 * Fetch the issue page. Returns the success line only when the response is HTTP 200.
 * Any other status, or a network error, throws. The email flag is included in the
 * error and is never a reason to return success.
 */
export async function reportPublished(
  input: PublishReportInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = input.issueUrl;
  let response: Response;
  try {
    response = await fetchImpl(url, { method: "GET", redirect: "follow" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SitePublishError(
      `site-publish failed: ${url} could not be fetched (${reason}). Email sent: ${input.emailSent}.`,
    );
  }

  if (response.status !== 200) {
    throw new SitePublishError(
      `site-publish failed: ${url} returned HTTP ${response.status}. Email sent: ${input.emailSent}.`,
    );
  }

  return `published: ${url} HTTP 200`;
}

/** Log the success line. Refuses anything that is not the verified HTTP 200 line. */
export function emitPublishReport(line: string, log: (message: string) => void = console.log) {
  if (!PUBLISHED_LINE.test(line)) {
    throw new SitePublishError(
      "refusing to report published without a verified HTTP 200 issue URL",
    );
  }
  log(line);
}
