import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getServerEnv } from "@/lib/env";

/**
 * Model roles are fixed (see SIGHTLINE_BUILD_PROMPT.md):
 *   - Anthropic via the Vercel AI SDK for ALL reasoning (summaries, Ask).
 *   - OpenAI text-embedding-3-small for embeddings ONLY — never as a chat model.
 */

let _reasoning: ReturnType<typeof createAnthropic> | null = null;
let _embeddings: ReturnType<typeof createOpenAI> | null = null;

function anthropic() {
  if (!_reasoning) {
    _reasoning = createAnthropic({ apiKey: getServerEnv().ANTHROPIC_API_KEY });
  }
  return _reasoning;
}

/** Whether OpenAI embeddings are configured (an API key is present). */
export function embeddingsConfigured(): boolean {
  return Boolean(getServerEnv().OPENAI_API_KEY);
}

function openai() {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) {
    // Should never be reached: callers gate on embeddingsConfigured() first.
    throw new Error("OpenAI is not configured (OPENAI_API_KEY is unset).");
  }
  if (!_embeddings) {
    _embeddings = createOpenAI({ apiKey });
  }
  return _embeddings;
}

/** The configured reasoning model id (e.g. claude-opus-4-8). */
export function reasoningModelId(): string {
  return getServerEnv().ANTHROPIC_MODEL;
}

export function embeddingModelId(): string {
  return getServerEnv().OPENAI_EMBEDDING_MODEL;
}

/** Anthropic LanguageModel for generateObject / streamText. */
export function reasoningModel() {
  return anthropic()(reasoningModelId());
}

/** OpenAI embedding model for embed / embedMany. */
export function embeddingModel() {
  return openai().textEmbeddingModel(embeddingModelId());
}

/** Dimensionality of text-embedding-3-small — must match vector(1536) in SQL. */
export const EMBEDDING_DIMENSIONS = 1536;
