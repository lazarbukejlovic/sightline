import "server-only";
import { generateText } from "ai";
import { prisma } from "@/lib/db/prisma";
import { reasoningModel, reasoningModelId } from "@/lib/ai/models";
import { logAiRun } from "@/lib/ai/runs";
import type { DateRange } from "@/lib/digest-range";

export interface DigestResult {
  digestId: string;
  changeCount: number;
  created: boolean;
}

/**
 * Build (or refresh) the weekly digest for one org. Aggregates the period's
 * changes and, when there are any, writes an LLM prose summary. Zero changes →
 * a fixed summary with NO AI spend. Idempotent via upsert on (orgId, periodStart),
 * so a retry can't create duplicate digests or double-charge.
 */
export async function generateOrgDigest(
  orgId: string,
  range: DateRange,
): Promise<DigestResult> {
  const changes = await prisma.change.findMany({
    where: {
      orgId,
      detectedAt: { gte: range.periodStart, lt: range.periodEnd },
      status: { not: "dismissed" },
    },
    orderBy: [{ impact: "desc" }, { detectedAt: "desc" }],
    include: { competitor: { select: { name: true } } },
    take: 100,
  });

  let summary: string;

  if (changes.length === 0) {
    summary =
      "No competitor changes were detected this week. Monitoring stays active — you'll see new intel here as soon as something changes.";
  } else {
    const lines = changes
      .map(
        (c) =>
          `- ${c.competitor.name} [${c.category}/${c.impact}] ${c.summary} (why: ${c.whyItMatters})`,
      )
      .join("\n");

    const startedAt = Date.now();
    const { text, usage } = await generateText({
      model: reasoningModel(),
      system:
        "You are a competitive-intelligence analyst writing a concise weekly briefing for a GTM team. " +
        "Summarize the week's competitor changes into a short, scannable digest: lead with the highest-impact items, " +
        "group related changes, and keep it grounded strictly in the provided list. No preamble, no invented detail.",
      prompt: `This week's detected changes:\n\n${lines}\n\nWrite the weekly digest (a few short paragraphs or bullets).`,
    });
    summary = text.trim();

    await logAiRun({
      orgId,
      type: "digest",
      model: reasoningModelId(),
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      latencyMs: Date.now() - startedAt,
      output: summary,
      metadata: { changeCount: changes.length },
    });
  }

  const digest = await prisma.digest.upsert({
    where: {
      orgId_periodStart: { orgId, periodStart: range.periodStart },
    },
    create: {
      orgId,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      summary,
      changeCount: changes.length,
    },
    update: {
      periodEnd: range.periodEnd,
      summary,
      changeCount: changes.length,
    },
    select: { id: true },
  });

  return { digestId: digest.id, changeCount: changes.length, created: true };
}
