/**
 * Pure scoring for the change-classification eval (no API, no server imports).
 * Compares a model's structured output against a golden expectation within a
 * tolerance so quality regressions are caught without flaky exact-match asserts.
 */
export type EvalCategory =
  | "pricing"
  | "product"
  | "positioning"
  | "hiring"
  | "funding"
  | "other";
export type EvalImpact = "low" | "medium" | "high";

export const IMPACT_RANK: Record<EvalImpact, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface Expectation {
  category: EvalCategory;
  impact: EvalImpact;
  /** Confidence must fall within [min, max]. */
  confidenceMin: number;
  confidenceMax: number;
}

export interface Classification {
  category: EvalCategory;
  impact: EvalImpact;
  confidence: number;
}

export interface CaseScore {
  categoryOk: boolean;
  /** Impact within `impactTolerance` ranks of expected. */
  impactOk: boolean;
  confidenceOk: boolean;
  pass: boolean;
}

export function scoreCase(
  expected: Expectation,
  actual: Classification,
  impactTolerance = 1,
): CaseScore {
  const categoryOk = actual.category === expected.category;
  const impactOk =
    Math.abs(IMPACT_RANK[actual.impact] - IMPACT_RANK[expected.impact]) <=
    impactTolerance;
  const confidenceOk =
    actual.confidence >= expected.confidenceMin &&
    actual.confidence <= expected.confidenceMax;
  return {
    categoryOk,
    impactOk,
    confidenceOk,
    pass: categoryOk && impactOk && confidenceOk,
  };
}

export interface Aggregate {
  n: number;
  categoryAccuracy: number;
  impactAccuracy: number;
  confidenceAccuracy: number;
  passRate: number;
}

export function aggregate(scores: CaseScore[]): Aggregate {
  const n = scores.length;
  if (n === 0) {
    return {
      n: 0,
      categoryAccuracy: 1,
      impactAccuracy: 1,
      confidenceAccuracy: 1,
      passRate: 1,
    };
  }
  const sum = (pred: (s: CaseScore) => boolean) =>
    scores.filter(pred).length / n;
  return {
    n,
    categoryAccuracy: sum((s) => s.categoryOk),
    impactAccuracy: sum((s) => s.impactOk),
    confidenceAccuracy: sum((s) => s.confidenceOk),
    passRate: sum((s) => s.pass),
  };
}

/** Tolerances CI asserts against — the "quality bar" for the analysis prompt. */
export const EVAL_THRESHOLDS = {
  categoryAccuracy: 0.8,
  impactAccuracy: 0.9,
  passRate: 0.75,
} as const;
