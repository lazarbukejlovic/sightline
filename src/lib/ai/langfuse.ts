import "server-only";
import { Langfuse } from "langfuse";
import { getServerEnv } from "@/lib/env";

/**
 * Optional LLM observability. When LANGFUSE_* keys are absent, every function
 * here is a no-op — tracing never blocks or breaks an AI call, and `ai_runs`
 * logging is unaffected. When configured, each AI call produces a trace +
 * generation (model, tokens, cost, latency).
 */

let client: Langfuse | null = null;
let initialized = false;

export function langfuseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY);
}

function getClient(): Langfuse | null {
  if (initialized) return client;
  initialized = true;
  if (!langfuseConfigured()) return null;
  const env = getServerEnv();
  try {
    client = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASEURL,
    });
  } catch (err) {
    console.warn("Langfuse init failed; tracing disabled:", err);
    client = null;
  }
  return client;
}

export interface TraceAiInput {
  name: string; // change_analyze | ask | embed | digest
  model: string;
  orgId: string;
  input?: unknown;
  output?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record one AI call as a Langfuse trace+generation. Best-effort: returns the
 * trace id on success, or null when Langfuse is unconfigured / the call failed.
 */
export async function traceAi(info: TraceAiInput): Promise<string | null> {
  const lf = getClient();
  if (!lf) return null;
  try {
    const trace = lf.trace({
      name: `ai.${info.name}`,
      metadata: { orgId: info.orgId, status: info.status, ...info.metadata },
    });
    trace.generation({
      name: info.name,
      model: info.model,
      input: info.input,
      output: info.output,
      usage: {
        input: info.inputTokens ?? 0,
        output: info.outputTokens ?? 0,
        total: (info.inputTokens ?? 0) + (info.outputTokens ?? 0),
        unit: "TOKENS",
        totalCost: info.costUsd,
      },
      metadata: { latencyMs: info.latencyMs, ...info.metadata },
    });
    await lf.flushAsync();
    return trace.id;
  } catch (err) {
    console.warn("Langfuse trace failed (non-fatal):", err);
    return null;
  }
}
