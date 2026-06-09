import "server-only";
import type { AiRunType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeCostUsd } from "@/lib/ai/pricing";

export interface LogAiRunInput {
  orgId: string;
  type: AiRunType;
  model: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  latencyMs: number;
  status?: string;
  traceId?: string | null;
}

/**
 * Persist an `ai_runs` row for every AI call (model, tokens, cost, latency).
 * Cost is derived from the pricing table. Returns the computed cost so callers
 * (e.g. Ask) can surface it in the UI. Best-effort: a logging failure must not
 * break the user-facing response.
 */
export async function logAiRun(input: LogAiRunInput): Promise<{
  id: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const costUsd = computeCostUsd(input.model, inputTokens, outputTokens);

  try {
    const run = await prisma.aiRun.create({
      data: {
        orgId: input.orgId,
        type: input.type,
        model: input.model,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: input.latencyMs,
        status: input.status ?? "success",
        traceId: input.traceId ?? null,
      },
      select: { id: true },
    });
    return { id: run.id, costUsd, inputTokens, outputTokens };
  } catch (err) {
    console.error("Failed to log ai_run:", err);
    return { id: null, costUsd, inputTokens, outputTokens };
  }
}
