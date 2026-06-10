/**
 * Pure scheduling helpers for Phase 2 monitoring. No DB / server imports so
 * they can be unit-tested directly.
 *
 * Safety invariants:
 *  - The shortest cadence we ever honor is DAILY; "hourly" is not offered.
 *  - A HARD 12-hour floor is enforced regardless of a source's configured
 *    frequency, so no source can be auto-scanned more than twice a day.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Absolute minimum gap between two scheduled scans of one source. */
export const MIN_SCAN_INTERVAL_MS = 12 * HOUR_MS;

export type ScanFrequency = "daily" | "weekly" | "manual";

/** Nominal interval for a configured frequency. "manual" never auto-scans. */
export function frequencyIntervalMs(frequency: string): number | null {
  switch (frequency) {
    case "daily":
      return DAY_MS;
    case "weekly":
      return 7 * DAY_MS;
    case "manual":
      return null;
    default:
      // Unknown/legacy values are treated as daily (never faster).
      return DAY_MS;
  }
}

/**
 * Effective interval = max(configured interval, 12h floor). Returns null for
 * "manual" (never scheduled).
 */
export function effectiveIntervalMs(frequency: string): number | null {
  const nominal = frequencyIntervalMs(frequency);
  if (nominal === null) return null;
  return Math.max(nominal, MIN_SCAN_INTERVAL_MS);
}

export interface ScheduleInput {
  scanFrequency: string;
  isActive: boolean;
  lastScannedAt: Date | null;
}

/**
 * Is this source due for a scheduled scan now? Inactive and "manual" sources
 * are never due. A never-scanned active source is due immediately.
 */
export function isDueForScan(source: ScheduleInput, now: Date = new Date()): boolean {
  if (!source.isActive) return false;
  const interval = effectiveIntervalMs(source.scanFrequency);
  if (interval === null) return false; // manual
  if (!source.lastScannedAt) return true;
  return now.getTime() - source.lastScannedAt.getTime() >= interval;
}
