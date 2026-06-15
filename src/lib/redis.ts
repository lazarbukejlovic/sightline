import "server-only";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env";

/** Shared Upstash Redis client (rate limiting + response cache). */
let _redis: Redis | null = null;

export function redisConfigured(): boolean {
  const e = getServerEnv();
  return Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis | null {
  if (!redisConfigured()) return null;
  if (!_redis) {
    const e = getServerEnv();
    _redis = new Redis({
      url: e.UPSTASH_REDIS_REST_URL!,
      token: e.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}
