# Sightline

> AI competitive-intelligence for B2B go-to-market teams. Sightline watches
> competitors' public footprint, detects what _meaningfully_ changed, explains
> _why it matters_ with cited evidence and a confidence score, and turns intel
> into live, collaborative battlecards.

This repository is being built **phase by phase**. See
[`SIGHTLINE_PLAN.md`](./SIGHTLINE_PLAN.md) for strategy and
[`SIGHTLINE_BUILD_PROMPT.md`](./SIGHTLINE_BUILD_PROMPT.md) for the build brief.

---

## Status — Phase 1: Core loop ✅

Phase 0 (foundation) + Phase 1 (the demoable core loop) are complete.

**Phase 0 — Foundation**

- **Next.js 15** (App Router) · **React 19** · **TypeScript (strict)**
- **Tailwind CSS v4** design system — "intelligence briefing", light-first
- **Framer Motion** for meaningful motion
- **Supabase Auth** foundation (`@supabase/ssr`) — sign-up / sign-in / sign-out
- **Prisma** schema + raw SQL for **RLS** and the auth→profile trigger
- App-layer multi-tenancy guard (`src/lib/org-scope.ts`)
- Premium landing page, protected `/app`
- **GitHub Actions** CI (lint · typecheck · test) + **Vitest**

**Phase 1 — Core loop**

- Add a **competitor** → add **sources** (pricing / changelog / blog / news /
  careers) — org-scoped, role-gated.
- Per-source **"Scan now"**: **Firecrawl** fetch → normalize → hash →
  `source_snapshot`; on change, an **Anthropic** (Vercel AI SDK, structured
  output) summary becomes a **change card** in the Intel Feed with category,
  impact, citation, and a confidence meter.
- **Ask Sightline** — RAG over collected intel: question embedded
  (**OpenAI `text-embedding-3-small`** → **pgvector**, org-scoped top-k),
  answer **streamed** with inline `[n]` citations and **token cost shown**.
- Every AI call logged to **`ai_runs`** (model, input/output tokens, cost,
  latency). Model roles are fixed: Anthropic for all reasoning, OpenAI for
  embeddings only.

**Model roles & default:** reasoning defaults to `claude-opus-4-8`
(override with `ANTHROPIC_MODEL`); embeddings are `text-embedding-3-small`.
The build prompt mandates the **Vercel AI SDK** for Anthropic access.

> Not yet built (later phases): Inngest cron, Review Queue, weekly digest,
> Stripe, Liveblocks battlecards, Langfuse, the AI cost dashboard UI.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Open http://localhost:3000.

### Required environment

See [`.env.example`](./.env.example). To run auth end-to-end you need a real
Supabase project and these values in `.env.local`:

| Variable                        | Where to find it                                |
| ------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API → service_role |
| `DATABASE_URL`                  | Supabase → Database → Connection string (pooler, 6543) |
| `DIRECT_URL`                    | Supabase → Database → Connection string (direct, 5432) |
| `ANTHROPIC_API_KEY`             | console.anthropic.com (reasoning) |
| `OPENAI_API_KEY`                | platform.openai.com — **optional**, embeddings only (see below) |
| `FIRECRAWL_API_KEY`             | firecrawl.dev (public-page fetching) |

> **OpenAI is optional.** Without it (or when it's out of quota), the full scan
> loop still runs — Firecrawl fetch, snapshot, hash, and the Anthropic change
> summary all work. Embeddings are skipped non-fatally (a failed `ai_run` is
> logged) and **Ask Sightline** shows a clean "unavailable until embeddings are
> enabled" notice instead of erroring. Add a funded key later to turn RAG on.

### Database setup

```bash
# 1. Create/sync the tables (Phase 0 + Phase 1).
npx prisma db push                                            # or: npm run prisma:migrate

# 2. Apply RLS + the auth→profile trigger (Phase 0).
psql "$DIRECT_URL" -f prisma/sql/0001_rls_and_triggers.sql

# 3. Apply pgvector + embedding column + HNSW index + Phase 1 RLS.
psql "$DIRECT_URL" -f prisma/sql/0002_phase1.sql
```

> No `psql`? Paste each `prisma/sql/*.sql` file into the Supabase **SQL editor**
> and run it. The SQL files are idempotent.

## Scripts

| Script                  | What it does                          |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Start the dev server                  |
| `npm run build`         | Production build                      |
| `npm run lint`          | ESLint (next/core-web-vitals)         |
| `npm run typecheck`     | `tsc --noEmit` (strict)               |
| `npm run test`          | Vitest unit/integration tests         |
| `npm run prisma:migrate`| Prisma dev migration                  |

## Multi-tenancy

Tenant isolation is enforced at **two layers**:

1. **Postgres RLS** keyed on `org_id` via the Supabase JWT — see
   [`prisma/sql/0001_rls_and_triggers.sql`](./prisma/sql/0001_rls_and_triggers.sql).
2. **App code** always scopes queries by the authenticated user's `org_id` —
   see [`src/lib/org-scope.ts`](./src/lib/org-scope.ts), proven by
   [`src/lib/org-scope.test.ts`](./src/lib/org-scope.test.ts).
