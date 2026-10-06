import { handleEventsRequest } from "@/lib/events/handler";
import { TokenBucketLimiter } from "@/lib/events/rate-limit";
import { getEventsDataset } from "@/lib/events/store";

export const runtime = "nodejs";

const limiter = new TokenBucketLimiter(60, 60_000);

export function GET(request: Request): Response {
  return handleEventsRequest(request, {
    env: process.env,
    now: () => new Date(),
    limiter,
    getDataset: getEventsDataset,
  });
}
