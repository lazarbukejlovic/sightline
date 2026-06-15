import { z } from "zod";

/**
 * The change-classification schema + prompt builder, kept free of server-only
 * imports so both the production path (src/lib/ai/analyze.ts) and the offline
 * eval (src/lib/ai/evals) share one source of truth for the prompt.
 */

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

export interface AnalyzeChangeInput {
  competitorName: string;
  sourceType: string;
  sourceUrl: string;
  isFirstSnapshot: boolean;
  diff: string;
  afterText: string;
}

const MAX_TEXT = 6000;

/** Build the system + user prompt for change analysis. */
export function buildAnalyzePrompt(input: AnalyzeChangeInput): {
  system: string;
  prompt: string;
} {
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

  return { system, prompt };
}
