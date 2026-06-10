import "server-only";
import { Liveblocks } from "@liveblocks/node";
import { getServerEnv } from "@/lib/env";

let client: Liveblocks | null = null;

/** Whether real-time collaboration is configured (a Liveblocks secret exists). */
export function liveblocksConfigured(): boolean {
  return Boolean(getServerEnv().LIVEBLOCKS_SECRET_KEY);
}

/** Server-side Liveblocks client (auth/token minting). Never sent to the browser. */
export function getLiveblocks(): Liveblocks {
  const secret = getServerEnv().LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    throw new Error("Liveblocks is not configured (LIVEBLOCKS_SECRET_KEY unset).");
  }
  if (!client) client = new Liveblocks({ secret });
  return client;
}
