import "server-only";
import { generateObject } from "ai";
import { fastModel } from "@/lib/ai/models";
import {
  changeAnalysisSchema,
  buildAnalyzePrompt,
  type ChangeAnalysis,
  type AnalyzeChangeInput,
} from "@/lib/ai/analyze-schema";

export {
  changeAnalysisSchema,
  type ChangeAnalysis,
  type AnalyzeChangeInput,
} from "@/lib/ai/analyze-schema";

export interface AnalyzeResult {
  analysis: ChangeAnalysis;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  model: string;
}

/**
 * Summarize and classify a detected change. Uses the cheaper "fast" reasoning
 * model (multi-model routing — change classification is structured, lower-stakes
 * than Ask answers). Returns structured output + usage; the caller logs the
 * `ai_run`. AI is decision-support: low confidence routes to the Review Queue.
 */
export async function analyzeChange(
  input: AnalyzeChangeInput,
): Promise<AnalyzeResult> {
  const { system, prompt } = buildAnalyzePrompt(input);
  const model = fastModel();

  // Note: no temperature/top_p — those are rejected by Opus/Claude 4.x.
  const { object, usage } = await generateObject({
    model,
    schema: changeAnalysisSchema,
    system,
    prompt,
  });

  return {
    analysis: object,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    model: model.modelId,
  };
}
