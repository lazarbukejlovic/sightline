import "server-only";
import { embed, embedMany } from "ai";
import { embeddingModel, embeddingsConfigured } from "@/lib/ai/models";

export { embeddingsConfigured };

export interface EmbedResult {
  embeddings: number[][];
  tokens: number;
}

/**
 * Embed many texts with OpenAI text-embedding-3-small. Embeddings ONLY — this
 * model is never used to generate answers. Throws if OpenAI is unconfigured or
 * the call fails (quota/billing); callers handle this gracefully.
 */
export async function embedTexts(values: string[]): Promise<EmbedResult> {
  if (values.length === 0) return { embeddings: [], tokens: 0 };
  const { embeddings, usage } = await embedMany({
    model: embeddingModel(),
    values,
  });
  return { embeddings, tokens: usage?.tokens ?? 0 };
}

/** Embed a single query string (for retrieval). */
export async function embedQuery(
  value: string,
): Promise<{ embedding: number[]; tokens: number }> {
  const { embedding, usage } = await embed({
    model: embeddingModel(),
    value,
  });
  return { embedding, tokens: usage?.tokens ?? 0 };
}

/**
 * Detect an OpenAI quota/billing failure so we can surface a precise,
 * non-alarming message instead of a generic error.
 */
export function isQuotaError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("insufficient_quota") ||
    message.includes("exceeded your current") ||
    message.includes("429")
  );
}

/** Serialize a JS number[] into the pgvector text literal: `[1,2,3]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
