export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until a request will be allowed again (0 when allowed). */
  retryAfterSeconds: number;
  /** Seconds until the bucket is full again. */
  resetSeconds: number;
};

type Bucket = { tokens: number; updatedMs: number };

/**
 * Token bucket per API key: `limit` requests per `windowMs`, refilled
 * continuously, bursts up to `limit`.
 *
 * State lives in this server instance's memory, so it is best-effort: on
 * Vercel each concurrently running instance keeps its own buckets and a cold
 * start resets them. Good enough for a handful of trusted keys; move to a
 * shared store (e.g. Upstash Redis) if strict global limits are needed.
 */
export class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;

  constructor(
    readonly limit = 60,
    readonly windowMs = 60_000,
    private readonly maxBuckets = 10_000,
  ) {
    this.refillPerMs = limit / windowMs;
  }

  take(key: string, nowMs: number): RateLimitResult {
    const existing = this.buckets.get(key);
    const tokens = existing
      ? Math.min(this.limit, existing.tokens + (nowMs - existing.updatedMs) * this.refillPerMs)
      : this.limit;

    if (!existing && this.buckets.size >= this.maxBuckets) this.prune(nowMs);

    if (tokens >= 1) {
      const left = tokens - 1;
      this.buckets.set(key, { tokens: left, updatedMs: nowMs });
      return {
        allowed: true,
        limit: this.limit,
        remaining: Math.floor(left),
        retryAfterSeconds: 0,
        resetSeconds: Math.ceil((this.limit - left) / this.refillPerMs / 1000),
      };
    }

    this.buckets.set(key, { tokens, updatedMs: nowMs });
    return {
      allowed: false,
      limit: this.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / this.refillPerMs / 1000)),
      resetSeconds: Math.ceil((this.limit - tokens) / this.refillPerMs / 1000),
    };
  }

  private prune(nowMs: number) {
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.updatedMs >= this.windowMs) this.buckets.delete(key);
    }
  }
}
