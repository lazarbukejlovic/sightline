import { describe, it, expect } from "vitest";
import {
  frequencyIntervalMs,
  effectiveIntervalMs,
  isDueForScan,
  MIN_SCAN_INTERVAL_MS,
  DAY_MS,
  HOUR_MS,
} from "@/lib/scan-schedule";

describe("frequencyIntervalMs", () => {
  it("maps known frequencies", () => {
    expect(frequencyIntervalMs("daily")).toBe(DAY_MS);
    expect(frequencyIntervalMs("weekly")).toBe(7 * DAY_MS);
    expect(frequencyIntervalMs("manual")).toBeNull();
  });

  it("treats unknown/legacy values as daily (never faster)", () => {
    expect(frequencyIntervalMs("hourly")).toBe(DAY_MS);
    expect(frequencyIntervalMs("")).toBe(DAY_MS);
  });
});

describe("effectiveIntervalMs — 12h hard floor", () => {
  it("never returns an interval below the 12h floor for scheduled sources", () => {
    for (const f of ["daily", "weekly", "hourly", "whatever"]) {
      const interval = effectiveIntervalMs(f);
      expect(interval).not.toBeNull();
      expect(interval as number).toBeGreaterThanOrEqual(MIN_SCAN_INTERVAL_MS);
    }
  });

  it("is null for manual (never auto-scanned)", () => {
    expect(effectiveIntervalMs("manual")).toBeNull();
  });

  it("MIN floor is exactly 12 hours", () => {
    expect(MIN_SCAN_INTERVAL_MS).toBe(12 * HOUR_MS);
  });
});

describe("isDueForScan", () => {
  const now = new Date("2026-06-09T12:00:00Z");

  it("never schedules inactive or manual sources", () => {
    expect(
      isDueForScan({ scanFrequency: "daily", isActive: false, lastScannedAt: null }, now),
    ).toBe(false);
    expect(
      isDueForScan({ scanFrequency: "manual", isActive: true, lastScannedAt: null }, now),
    ).toBe(false);
  });

  it("schedules a never-scanned active source immediately", () => {
    expect(
      isDueForScan({ scanFrequency: "daily", isActive: true, lastScannedAt: null }, now),
    ).toBe(true);
  });

  it("does not re-scan within the cadence", () => {
    const oneHourAgo = new Date(now.getTime() - 1 * HOUR_MS);
    expect(
      isDueForScan({ scanFrequency: "daily", isActive: true, lastScannedAt: oneHourAgo }, now),
    ).toBe(false);
  });

  it("respects the 12h floor even if scanned recently", () => {
    const tenHoursAgo = new Date(now.getTime() - 10 * HOUR_MS);
    expect(
      isDueForScan({ scanFrequency: "daily", isActive: true, lastScannedAt: tenHoursAgo }, now),
    ).toBe(false);
  });

  it("scans again once the daily interval has elapsed", () => {
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * HOUR_MS);
    expect(
      isDueForScan(
        { scanFrequency: "daily", isActive: true, lastScannedAt: twentyFiveHoursAgo },
        now,
      ),
    ).toBe(true);
  });
});
