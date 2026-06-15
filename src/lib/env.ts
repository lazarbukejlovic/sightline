import { z } from "zod";

/**
 * Validated environment access.
 *
 * Split into `client` (NEXT_PUBLIC_*, safe in the browser) and `server`
 * (secrets that must never reach the client). The server schema is only
 * parsed on the server; importing it from a client component will throw.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  // Phase 1 — external services (server-only).
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-4-8"),
  // Cheaper model for lower-stakes structured calls (change classification,
  // battlecard drafts) — multi-model routing to cut cost. Still Anthropic.
  ANTHROPIC_FAST_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  // OpenAI is OPTIONAL — embeddings / Ask Sightline RAG degrade gracefully
  // when it is absent or out of quota. The core scan loop never depends on it.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  FIRECRAWL_API_KEY: z.string().min(1),
  // Phase 2 — background jobs (Inngest). Optional in local dev (the Inngest
  // dev server needs no keys); required in production to sign/serve.
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  // Phase 2 — LLM observability (Langfuse). OPTIONAL; tracing no-ops when unset.
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
  LANGFUSE_BASEURL: z.string().url().optional(),
  // Phase 3 — real-time collaboration (Liveblocks). OPTIONAL for build/tests;
  // required at runtime to open battlecard rooms (the editor degrades to a
  // clean "collaboration unavailable" notice when unset).
  LIVEBLOCKS_SECRET_KEY: z.string().min(1).optional(),
  // Phase 4 — billing (Stripe, TEST MODE). All OPTIONAL: billing degrades to a
  // clean "billing unavailable" notice when unset, and every feature gate
  // treats an unconfigured Stripe as "free plan". Never use live keys here.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRO_PRICE_ID: z.string().min(1).optional(),
  STRIPE_TEAM_PRICE_ID: z.string().min(1).optional(),
  STRIPE_AI_USAGE_PRICE_ID: z.string().min(1).optional(),
  // The meter event name behind STRIPE_AI_USAGE_PRICE_ID's billing meter.
  STRIPE_AI_USAGE_METER_EVENT: z.string().min(1).default("ai_answer"),
  // Phase 5 — rate limiting (Upstash Redis). OPTIONAL: when unset, the limiter
  // falls back to a best-effort in-memory window (fine for dev/single instance).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Parse a raw record against the client schema. Exported (rather than only
 * the singleton) so it can be unit-tested without real process env.
 */
export function parseClientEnv(source: Record<string, string | undefined>): ClientEnv {
  const parsed = clientSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid client environment variables:\n${format(parsed.error)}`,
    );
  }
  return parsed.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${format(parsed.error)}`,
    );
  }
  return parsed.data;
}

// NEXT_PUBLIC_* are statically inlined by Next, so reference them explicitly.
export const clientEnv: ClientEnv = parseClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

/** Lazily resolve server env so client bundles never evaluate it. */
let cachedServerEnv: ServerEnv | null = null;
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  cachedServerEnv = parseServerEnv(process.env);
  return cachedServerEnv;
}
