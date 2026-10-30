/**
 * Last step of a letter run. Exit 0 only after the live issue URL returns HTTP 200.
 *
 *   npm run publish:verify -- --email-sent https://www.southbaywithkids.com/issues/<slug>
 *
 * `--email-sent` records that the newsletter send succeeded. It does not
 * skip the site check and it cannot produce a success line on its own.
 */
import { emitPublishReport, reportPublished } from "../lib/site-publish";

const args = process.argv.slice(2);
const emailSent = args.includes("--email-sent");
const issueUrl = args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));

if (!issueUrl) {
  console.error(
    "usage: npm run publish:verify -- [--email-sent] https://www.southbaywithkids.com/issues/<slug>",
  );
  process.exit(1);
}

reportPublished({ emailSent, issueUrl })
  .then((line) => {
    emitPublishReport(line);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
