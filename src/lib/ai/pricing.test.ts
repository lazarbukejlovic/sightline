import { describe, it, expect } from "vitest";
import { computeCostUsd, priceFor, MODEL_PRICING } from "@/lib/ai/pricing";

describe("priceFor", () => {
  it("returns the price for a known model", () => {
    expect(priceFor("claude-opus-4-8")).toEqual({ input: 5, output: 25 });
  });

  it("falls back to zero for an unknown model (never NaN)", () => {
    expect(priceFor("made-up-model")).toEqual({ input: 0, output: 0 });
  });

  it("prices the embedding model with no output cost", () => {
    expect(MODEL_PRICING["text-embedding-3-small"]).toEqual({
      input: 0.02,
      output: 0,
    });
  });
});

describe("computeCostUsd", () => {
  it("computes Opus 4.8 cost from input/output tokens", () => {
    // 1M in @ $5 + 1M out @ $25 = $30
    expect(computeCostUsd("claude-opus-4-8", 1_000_000, 1_000_000)).toBe(30);
  });

  it("computes a small realistic answer cost", () => {
    // 2000 in @ $5/M = 0.01 ; 500 out @ $25/M = 0.0125 → 0.0225
    expect(computeCostUsd("claude-opus-4-8", 2000, 500)).toBeCloseTo(0.0225, 6);
  });

  it("rounds to 6 decimal places", () => {
    const cost = computeCostUsd("text-embedding-3-small", 1234, 0);
    expect(cost).toBe(Math.round(cost * 1e6) / 1e6);
  });

  it("is zero for an unknown model", () => {
    expect(computeCostUsd("unknown", 5000, 5000)).toBe(0);
  });
});
