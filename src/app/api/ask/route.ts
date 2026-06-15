import { type NextRequest } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { requireOrgContext } from "@/lib/org/context";
import { reasoningModel, reasoningModelId, embeddingModelId } from "@/lib/ai/models";
import {
  embedQuery,
  embeddingsConfigured,
  isQuotaError,
} from "@/lib/ai/embeddings";
import { retrieveChunks, buildAskPrompt } from "@/lib/ai/ask";
import { logAiRun } from "@/lib/ai/runs";
import { computeCostUsd } from "@/lib/ai/pricing";
import { reportAiUsage } from "@/lib/billing/subscription";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import {
  answerCacheKey,
  getCachedAnswer,
  setCachedAnswer,
} from "@/lib/ai/answer-cache";

const UNAVAILABLE_MESSAGE =
  "Ask Sightline is unavailable until embeddings are enabled. Your scans and snapshots are still saved.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(1000),
  competitorId: z.string().uuid().optional(),
});

/**
 * Ask Sightline — RAG over collected intel. Streams a custom NDJSON protocol so
 * the UI can show: the sources panel up front, the answer streaming with inline
 * [n] citations, and the token cost once the call completes.
 *
 * Lines: {"type":"sources",...} → {"type":"text",...}* → {"type":"done",...}
 */
export async function POST(request: NextRequest) {
  const { user, orgId } = await requireOrgContext();

  // Abuse protection: per-org+user limit on Ask answers.
  const rl = await rateLimit(`${orgId}:${user.id}`, RATE_LIMITS.ask);
  if (!rl.success) {
    return Response.json(
      {
        error: `Too many questions — try again in ${rl.resetSeconds}s.`,
        retryAfter: rl.resetSeconds,
      },
      { status: 429, headers: { "Retry-After": String(rl.resetSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid question." }, { status: 400 });
  }
  const { question, competitorId } = parsed.data;
  const encoder = new TextEncoder();

  // Response cache: replay a recent identical answer (org-scoped) for free.
  const cacheKey = answerCacheKey(orgId, question, competitorId);
  const cached = await getCachedAnswer(cacheKey);
  if (cached) {
    const replay = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        send({ type: "sources", citations: cached.citations });
        send({ type: "text", text: cached.answer });
        send({ type: "done", runId: null, cached: true, cost: cached.cost });
        controller.close();
      },
    });
    return new Response(replay, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Ask Sightline depends on embeddings. If OpenAI isn't configured, return a
  // clean, non-error notice (HTTP 200) — the scan loop is unaffected.
  if (!embeddingsConfigured()) {
    return Response.json({ unavailable: true, message: UNAVAILABLE_MESSAGE });
  }

  // 1. Embed the question. Quota/billing failure → same clean notice.
  let embedding: number[];
  let embedTokens: number;
  try {
    const result = await embedQuery(question);
    embedding = result.embedding;
    embedTokens = result.tokens;
  } catch (err) {
    if (isQuotaError(err)) {
      return Response.json({ unavailable: true, message: UNAVAILABLE_MESSAGE });
    }
    return Response.json(
      { error: "Failed to embed the question." },
      { status: 500 },
    );
  }

  await logAiRun({
    orgId,
    type: "embed",
    model: embeddingModelId(),
    inputTokens: embedTokens,
    outputTokens: 0,
    latencyMs: 0,
  });

  // 2. Retrieve org-scoped context. No intel yet → clean notice (no LLM spend).
  const chunks = await retrieveChunks(orgId, embedding, 6, competitorId);
  if (chunks.length === 0) {
    return Response.json({ unavailable: true, message: UNAVAILABLE_MESSAGE });
  }

  const { system, prompt, citations } = buildAskPrompt(question, chunks);

  const model = reasoningModelId();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "sources", citations });

      const startedAt = Date.now();
      try {
        // No temperature/top_p — rejected by Opus 4.x.
        const result = streamText({ model: reasoningModel(), system, prompt });

        let fullText = "";
        for await (const delta of result.textStream) {
          fullText += delta;
          send({ type: "text", text: delta });
        }

        const usage = await result.usage;
        const inputTokens = usage?.inputTokens ?? 0;
        const outputTokens = usage?.outputTokens ?? 0;
        const costUsd = computeCostUsd(model, inputTokens, outputTokens);

        const run = await logAiRun({
          orgId,
          type: "ask",
          model,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          input: question,
          output: fullText,
          metadata: { sources: citations.length, competitorId },
        });

        // Report one unit of metered AI usage to Stripe (best-effort, no-op
        // unless billing is configured and the org has a customer).
        await reportAiUsage(orgId);

        const cost = { inputTokens, outputTokens, costUsd, model };
        // Cache for repeat questions (best-effort; never breaks the response).
        await setCachedAnswer(cacheKey, {
          answer: fullText,
          citations,
          cost,
        }).catch(() => {});

        send({ type: "done", runId: run.id, cost });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Unknown error.";
        send({ type: "error", error: detail });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
