import { describe, it, expect } from "vitest";
import { weeklyRange, formatRange } from "@/lib/digest-range";

describe("weeklyRange", () => {
  it("is the 7-day window ending at now", () => {
    const now = new Date("2026-06-09T09:00:00Z");
    const { periodStart, periodEnd } = weeklyRange(now);
    expect(periodEnd).toEqual(now);
    expect(periodEnd.getTime() - periodStart.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    expect(periodStart.toISOString()).toBe("2026-06-02T09:00:00.000Z");
  });
});

describe("formatRange", () => {
  it("renders a readable span", () => {
    const out = formatRange({
      periodStart: new Date("2026-06-02T00:00:00Z"),
      periodEnd: new Date("2026-06-09T00:00:00Z"),
    });
    expect(out).toMatch(/–/);
    expect(out).toMatch(/Jun/);
  });
});
