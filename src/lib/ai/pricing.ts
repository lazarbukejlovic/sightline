/**
 * Per-model pricing (USD per 1,000,000 tokens) for cost tracking in `ai_runs`.
 * Pure and table-driven so it can be unit-tested without any API calls.
 *
 * Sources: Anthropic + OpenAI public pricing (cached). Update when prices move.
 */
export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. Embedding models have no output cost. */
  output: number;
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic (reasoning)
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  // OpenAI (embeddings only)
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

/** Fallback used when a model id isn't in the table, so cost is never NaN. */
const FALLBACK_PRICE: ModelPrice = { input: 0, output: 0 };

export function priceFor(model: string): ModelPrice {
  return MODEL_PRICING[model] ?? FALLBACK_PRICE;
}

/**
 * Compute the USD cost of a call. Rounded to 6 decimal places (matches the
 * `ai_runs.cost_usd numeric(12,6)` column).
 */
export function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(model);
  const cost =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
