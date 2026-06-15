import type {
  Classification,
  EvalCategory,
  EvalImpact,
  Expectation,
} from "@/lib/ai/evals/score";

/**
 * Golden eval set for the change-classification prompt. Each case carries:
 *   - `input`    — what the analysis prompt would receive,
 *   - `expected` — the golden classification + a confidence band,
 *   - `recorded` — a cached model output ("cassette") so CI is deterministic
 *                  and free. `EVAL_LIVE=1 npm run eval` re-runs the real prompt
 *                  and these recordings can be refreshed.
 *
 * Keep cases representative across categories/impact levels. Scoring tolerances
 * live in score.ts (EVAL_THRESHOLDS).
 */
export interface GoldenCase {
  id: string;
  input: {
    competitorName: string;
    sourceType: string;
    sourceUrl: string;
    isFirstSnapshot: boolean;
    diff: string;
    afterText: string;
  };
  expected: Expectation;
  recorded: Classification;
}

const cat = (c: EvalCategory) => c;
const imp = (i: EvalImpact) => i;

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "pricing-usage-based",
    input: {
      competitorName: "Northwind",
      sourceType: "pricing",
      sourceUrl: "https://northwind.com/pricing",
      isFirstSnapshot: false,
      diff: "- Pro — $49 / seat / month\n+ Pro — $0 base + usage-based credits\n+ Free tier added",
      afterText:
        "Pro — $0 base + usage-based credits. Free tier with 1 seat. Metered AI credits beyond the free allotment.",
    },
    expected: {
      category: cat("pricing"),
      impact: imp("high"),
      confidenceMin: 0.7,
      confidenceMax: 1,
    },
    recorded: { category: "pricing", impact: "high", confidence: 0.9 },
  },
  {
    id: "product-integration",
    input: {
      competitorName: "Halcyon",
      sourceType: "changelog",
      sourceUrl: "https://halcyon.io/changelog",
      isFirstSnapshot: false,
      diff: "+ Native Salesforce sync\n+ Redesigned reporting dashboard",
      afterText:
        "Shipped a native Salesforce sync and a redesigned reporting dashboard.",
    },
    expected: {
      category: cat("product"),
      impact: imp("medium"),
      confidenceMin: 0.6,
      confidenceMax: 1,
    },
    recorded: { category: "product", impact: "medium", confidence: 0.78 },
  },
  {
    id: "funding-unconfirmed",
    input: {
      competitorName: "Vertex Labs",
      sourceType: "news",
      sourceUrl: "https://techfunding.news/vertex",
      isFirstSnapshot: false,
      diff: "+ Reports of a possible Series B (unconfirmed)",
      afterText: "News mentions a possible Series B; figures are unconfirmed.",
    },
    expected: {
      category: cat("funding"),
      impact: imp("high"),
      confidenceMin: 0.3,
      confidenceMax: 0.75,
    },
    recorded: { category: "funding", impact: "high", confidence: 0.55 },
  },
  {
    id: "hiring-gtm",
    input: {
      competitorName: "Linear",
      sourceType: "careers",
      sourceUrl: "https://linear.app/careers",
      isFirstSnapshot: false,
      diff: "+ Head of Sales\n+ 2x Solutions Engineer",
      afterText:
        "Opened a Head of Sales role and two Solutions Engineer roles.",
    },
    expected: {
      category: cat("hiring"),
      impact: imp("low"),
      confidenceMin: 0.5,
      confidenceMax: 1,
    },
    recorded: { category: "hiring", impact: "low", confidence: 0.66 },
  },
  {
    id: "positioning-messaging",
    input: {
      competitorName: "Acme",
      sourceType: "blog",
      sourceUrl: "https://acme.com/blog/why-we-rebuilt",
      isFirstSnapshot: false,
      diff: "- The fastest analytics platform\n+ The AI-native analytics platform for enterprises",
      afterText:
        "Repositioned from 'fastest analytics' to 'AI-native analytics for enterprises'.",
    },
    expected: {
      category: cat("positioning"),
      impact: imp("medium"),
      confidenceMin: 0.55,
      confidenceMax: 1,
    },
    recorded: { category: "positioning", impact: "medium", confidence: 0.72 },
  },
  {
    id: "pricing-ai-bundled",
    input: {
      competitorName: "Notion",
      sourceType: "pricing",
      sourceUrl: "https://www.notion.so/pricing",
      isFirstSnapshot: false,
      diff: "- Business — $15/seat · AI +$8/seat\n+ Business — $15/seat · AI included",
      afterText: "Bundled AI into the Business plan at no extra per-seat cost.",
    },
    expected: {
      category: cat("pricing"),
      impact: imp("high"),
      confidenceMin: 0.7,
      confidenceMax: 1,
    },
    recorded: { category: "pricing", impact: "high", confidence: 0.84 },
  },
  {
    id: "noise-cosmetic",
    input: {
      competitorName: "Globex",
      sourceType: "blog",
      sourceUrl: "https://globex.com/blog",
      isFirstSnapshot: false,
      diff: "- Posted 3 days ago\n+ Posted 4 days ago",
      afterText: "Footer timestamp changed; no substantive content change.",
    },
    expected: {
      category: cat("other"),
      impact: imp("low"),
      confidenceMin: 0.4,
      confidenceMax: 1,
    },
    recorded: { category: "other", impact: "low", confidence: 0.6 },
  },
];
