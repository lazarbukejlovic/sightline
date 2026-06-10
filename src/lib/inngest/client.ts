import { Inngest } from "inngest";

/** Typed payload for the per-source scan event. */
export interface ScanRequestedData {
  orgId: string;
  sourceId: string;
  manual?: boolean;
}

/**
 * Inngest client. Event/signing keys are read from the environment
 * (INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY); the local dev server needs none.
 */
export const inngest = new Inngest({ id: "sightline" });
