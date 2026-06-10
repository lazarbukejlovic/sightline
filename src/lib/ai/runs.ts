import "server-only";
import type { AiRunType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeCostUsd } from "@/lib/ai/pricing";
import { traceAi } from "@/lib/ai/langfuse";

export interface LogAiRunInput {
  orgId: string;
  type: AiRunType;
  model: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  latencyMs: number;
  status?: string;
  /** Optional prompt/result + metadata, forwarded to Langfuse only. */
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Persist an `ai_runs` row for every AI call (model, tokens, cost, latency) AND
 * emit a Langfuse trace (no-op when Langfuse is unconfigured). The Langfuse
 * trace id is stored on the row for cross-referencing. Best-effort: a logging
 * or tracing failure must never break the user-facing response.
 */
export async function logAiRun(input: LogAiRunInput): Promise<{
  id: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  traceId: string | null;
}> {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const status = input.status ?? "success";
  const costUsd = computeCostUsd(input.model, inputTokens, outputTokens);

  // Trace first so we can persist the trace id alongside the run.
  const traceId = await traceAi({
    name: input.type,
    model: input.model,
    orgId: input.orgId,
    input: input.input,
    output: input.output,
    inputTokens,
    outputTokens,
    costUsd,
    latencyMs: input.latencyMs,
    status,
    metadata: input.metadata,
  });

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
        status,
        traceId,
      },
      select: { id: true },
    });
    return { id: run.id, costUsd, inputTokens, outputTokens, traceId };
  } catch (err) {
    console.error("Failed to log ai_run:", err);
    return { id: null, costUsd, inputTokens, outputTokens, traceId };
  }
}
