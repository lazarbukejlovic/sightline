import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { reasoningModel } from "@/lib/ai/models";

/** Structured change classification. Mirrors the `changes` table enums. */
export const changeAnalysisSchema = z.object({
  isMeaningful: z
    .boolean()
    .describe(
      "True only if the diff reflects a substantive change a GTM team would care about (pricing, product, positioning, hiring, funding). False for cosmetic/boilerplate/navigation noise.",
    ),
  summary: z
    .string()
    .describe("One or two sentences stating plainly what changed. No preamble."),
  whyItMatters: z
    .string()
    .describe("A single line on why this matters to a sales/product team."),
  category: z.enum([
    "pricing",
    "product",
    "positioning",
    "hiring",
    "funding",
    "other",
  ]),
  impact: z.enum(["low", "medium", "high"]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "0–1 confidence that this summary/classification is correct given the evidence. Be honest; low confidence routes to a human review queue.",
    ),
});

export type ChangeAnalysis = z.infer<typeof changeAnalysisSchema>;

export interface AnalyzeResult {
  analysis: ChangeAnalysis;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

const MAX_TEXT = 6000;

export interface AnalyzeChangeInput {
  competitorName: string;
  sourceType: string;
  sourceUrl: string;
  isFirstSnapshot: boolean;
  diff: string;
  afterText: string;
}

/**
 * Summarize and classify a detected change using the Anthropic reasoning model.
 * Returns structured output + token usage; the caller logs the `ai_run` (it
 * holds the verified org_id). AI is decision-support: low confidence is routed
 * to the human Review Queue downstream.
 */
export async function analyzeChange(
  input: AnalyzeChangeInput,
): Promise<AnalyzeResult> {
  const system =
    "You are a competitive-intelligence analyst for B2B go-to-market teams. " +
    "You analyze changes on competitors' public pages and explain why they matter, " +
    "grounded strictly in the evidence provided. Never invent details not present in the text. " +
    "Respond directly, without preamble.";

  const context = input.isFirstSnapshot
    ? `This is the FIRST snapshot of this page, so treat the content as the current baseline state.\n\nPAGE CONTENT:\n${input.afterText.slice(0, MAX_TEXT)}`
    : `A change was detected on this page. Below is a diff (lines removed with -, added with +) followed by the current page content for context.\n\nDIFF:\n${input.diff.slice(0, MAX_TEXT)}\n\nCURRENT PAGE CONTENT:\n${input.afterText.slice(0, MAX_TEXT)}`;

  const prompt = `Competitor: ${input.competitorName}
Source type: ${input.sourceType}
Source URL: ${input.sourceUrl}

${context}

Analyze the change. If it is purely cosmetic or boilerplate, set isMeaningful to false.`;

  // Note: no temperature/top_p — those are rejected by Opus 4.x.
  const { object, usage } = await generateObject({
    model: reasoningModel(),
    schema: changeAnalysisSchema,
    system,
    prompt,
  });

  return {
    analysis: object,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  };
}
