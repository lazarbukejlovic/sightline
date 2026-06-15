import { describe, it, expect } from "vitest";
import { GOLDEN_CASES } from "@/lib/ai/evals/golden";
import {
  scoreCase,
  aggregate,
  EVAL_THRESHOLDS,
  IMPACT_RANK,
  type CaseScore,
} from "@/lib/ai/evals/score";
import { classify, isLive } from "@/lib/ai/evals/run";

/**
 * Prompt eval. In CI this runs against cached "cassette" outputs (deterministic,
 * no API spend) and asserts the analysis prompt's quality stays within
 * tolerance. `EVAL_LIVE=1 npm run eval` runs the real prompt against Anthropic.
 */
describe("change-classification eval", () => {
  it("scorer: exact category, impact within tolerance, confidence in band", () => {
    const exact = scoreCase(
      { category: "pricing", impact: "high", confidenceMin: 0.7, confidenceMax: 1 },
      { category: "pricing", impact: "high", confidence: 0.9 },
    );
    expect(exact.pass).toBe(true);

    const wrongCategory = scoreCase(
      { category: "pricing", impact: "high", confidenceMin: 0.7, confidenceMax: 1 },
      { category: "product", impact: "high", confidence: 0.9 },
    );
    expect(wrongCategory.categoryOk).toBe(false);
    expect(wrongCategory.pass).toBe(false);

    // impact off by one rank is tolerated; off by two is not.
    expect(IMPACT_RANK.high - IMPACT_RANK.low).toBe(2);
    const offByTwo = scoreCase(
      { category: "hiring", impact: "high", confidenceMin: 0, confidenceMax: 1 },
      { category: "hiring", impact: "low", confidence: 0.5 },
    );
    expect(offByTwo.impactOk).toBe(false);
  });

  it(`meets quality tolerances (${isLive() ? "LIVE" : "cached"})`, async () => {
    const scores: CaseScore[] = [];
    for (const c of GOLDEN_CASES) {
      const actual = await classify(c);
      scores.push(scoreCase(c.expected, actual));
    }
    const agg = aggregate(scores);

    expect(agg.n).toBe(GOLDEN_CASES.length);
    expect(agg.categoryAccuracy).toBeGreaterThanOrEqual(
      EVAL_THRESHOLDS.categoryAccuracy,
    );
    expect(agg.impactAccuracy).toBeGreaterThanOrEqual(
      EVAL_THRESHOLDS.impactAccuracy,
    );
    expect(agg.passRate).toBeGreaterThanOrEqual(EVAL_THRESHOLDS.passRate);
  }, 60_000);
});
