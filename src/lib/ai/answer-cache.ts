import "server-only";
import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";

/**
 * Org-scoped cache of recent Ask answers, to cut cost + latency on repeat
 * questions. Keyed by (orgId, competitorId, normalized question). Uses Upstash
 * Redis when configured, else a small in-memory TTL map. Short TTL bounds
 * staleness; the key includes org_id so answers never cross tenants.
 */
export interface CachedAnswer {
  answer: string;
  citations: unknown[];
  cost: unknown;
}

const TTL_SECONDS = 600; // 10 minutes
const mem = new Map<string, { exp: number; val: CachedAnswer }>();

export function answerCacheKey(
  orgId: string,
  question: string,
  competitorId?: string,
): string {
  const norm = question.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256")
    .update(`${orgId}|${competitorId ?? ""}|${norm}`)
    .digest("hex");
  return `ask:${hash}`;
}

export async function getCachedAnswer(key: string): Promise<CachedAnswer | null> {
  const redis = getRedis();
  if (redis) {
    return (await redis.get<CachedAnswer>(key)) ?? null;
  }
  const entry = mem.get(key);
  if (entry && entry.exp > Date.now()) return entry.val;
  if (entry) mem.delete(key);
  return null;
}

export async function setCachedAnswer(
  key: string,
  val: CachedAnswer,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, val, { ex: TTL_SECONDS });
    return;
  }
  mem.set(key, { exp: Date.now() + TTL_SECONDS * 1000, val });
}
