import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  changeAnalysisSchema,
  buildAnalyzePrompt,
  type AnalyzeChangeInput,
} from "@/lib/ai/analyze-schema";
import type { Classification } from "@/lib/ai/evals/score";
import type { GoldenCase } from "@/lib/ai/evals/golden";

/**
 * Eval classification runner. Deliberately free of server-only imports so it
 * runs in the Vitest (node) environment. Two modes:
 *   - cached  (default, CI): returns the case's recorded "cassette" — free and
 *     deterministic, so CI never burns API credits.
 *   - live    (EVAL_LIVE=1): calls the real analysis prompt against Anthropic.
 */
export function isLive(): boolean {
  return process.env.EVAL_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
}

export function classifyCached(c: GoldenCase): Promise<Classification> {
  return Promise.resolve(c.recorded);
}

export async function classifyLive(
  input: AnalyzeChangeInput,
): Promise<Classification> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  });
  const model = anthropic(process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5");
  const { system, prompt } = buildAnalyzePrompt(input);
  const { object } = await generateObject({
    model,
    schema: changeAnalysisSchema,
    system,
    prompt,
  });
  return {
    category: object.category,
    impact: object.impact,
    confidence: object.confidence,
  };
}

export function classify(c: GoldenCase): Promise<Classification> {
  return isLive() ? classifyLive(c.input) : classifyCached(c);
}
