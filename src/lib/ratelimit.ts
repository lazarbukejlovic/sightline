import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis, redisConfigured } from "@/lib/redis";

/**
 * Per-identifier rate limiting for abuse protection on the scan + Ask paths.
 *
 * Uses Upstash Redis (sliding window) when UPSTASH_REDIS_REST_* are configured —
 * correct across serverless instances. Falls back to a best-effort in-memory
 * window otherwise, so local dev / CI / unconfigured deploys still work (the
 * fallback is per-instance and approximate, which is fine when there's one).
 */

export interface RateResult {
  success: boolean;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  resetSeconds: number;
}

interface LimitSpec {
  prefix: string;
  limit: number;
  windowSec: number;
}

/** Tuned limits. Generous enough for real use, tight enough to stop abuse. */
export const RATE_LIMITS = {
  ask: { prefix: "ask", limit: 20, windowSec: 60 } satisfies LimitSpec,
  scan: { prefix: "scan", limit: 12, windowSec: 60 } satisfies LimitSpec,
} as const;

export const rateLimitConfigured = redisConfigured;

const upstashLimiters = new Map<string, Ratelimit>();
function getUpstashLimiter(spec: LimitSpec): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${spec.prefix}:${spec.limit}:${spec.windowSec}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(
        spec.limit,
        `${spec.windowSec} s` as `${number} s`,
      ),
      prefix: `rl:${spec.prefix}`,
      analytics: false,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// In-memory fallback: per-key timestamps within the window.
const memBuckets = new Map<string, number[]>();
function memLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const recent = (memBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    memBuckets.set(key, recent);
    const oldest = recent[0]!;
    return {
      success: false,
      remaining: 0,
      resetSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  recent.push(now);
  memBuckets.set(key, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (memBuckets.size > 5000) {
    for (const [k, v] of memBuckets) {
      if (v.every((t) => now - t >= windowMs)) memBuckets.delete(k);
    }
  }
  return {
    success: true,
    remaining: limit - recent.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}

/** Check + consume one unit for `identifier` against a limit spec. */
export async function rateLimit(
  identifier: string,
  spec: LimitSpec,
): Promise<RateResult> {
  const upstash = getUpstashLimiter(spec);
  if (upstash) {
    const res = await upstash.limit(identifier);
    return {
      success: res.success,
      remaining: res.remaining,
      resetSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }
  return memLimit(`${spec.prefix}:${identifier}`, spec.limit, spec.windowSec * 1000);
}
