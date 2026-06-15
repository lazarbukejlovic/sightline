import "server-only";
import { generateText } from "ai";
import { prisma } from "@/lib/db/prisma";
import { fastModel, fastModelId } from "@/lib/ai/models";
import { logAiRun } from "@/lib/ai/runs";
import { ensureBattlecard } from "@/lib/battlecard";

export interface SuggestInput {
  orgId: string;
  competitorId: string;
  competitorName: string;
  changeId: string;
  summary: string;
  whyItMatters: string;
  category: string;
}

/**
 * Draft a PENDING battlecard edit from a high-impact change. Best-effort and
 * NON-THROWING by design: a failure here must never break the (idempotent) scan
 * step or duplicate the change. The suggestion is never auto-applied — a human
 * approves it in the editor (or rejects it).
 */
export async function maybeSuggestBattlecard(input: SuggestInput): Promise<void> {
  try {
    const battlecard = await ensureBattlecard(
      input.orgId,
      input.competitorId,
      `${input.competitorName} battlecard`,
    );

    const startedAt = Date.now();
    const { text, usage } = await generateText({
      model: fastModel(),
      system:
        "You help sales teams keep competitor battlecards current. Given a newly detected, " +
        "high-impact competitor change, draft a SHORT battlecard edit (2–4 bullet points) a rep " +
        "could use on a call: what changed, why it matters, and a suggested counter/talk-track. " +
        "Ground it strictly in the change provided. No preamble.",
      prompt: `Competitor: ${input.competitorName}
Category: ${input.category}
Change: ${input.summary}
Why it matters: ${input.whyItMatters}

Draft the suggested battlecard edit:`,
    });

    await logAiRun({
      orgId: input.orgId,
      type: "battlecard_suggest",
      model: fastModelId(),
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      latencyMs: Date.now() - startedAt,
      output: text,
      metadata: { changeId: input.changeId, competitorId: input.competitorId },
    });

    await prisma.battlecardSuggestion.create({
      data: {
        orgId: input.orgId,
        battlecardId: battlecard.id,
        competitorId: input.competitorId,
        changeId: input.changeId,
        content: text.trim(),
        status: "pending",
      },
    });
  } catch (err) {
    console.warn("battlecard.suggest skipped (non-fatal):", err);
  }
}
