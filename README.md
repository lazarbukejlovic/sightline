# Sightline

> AI competitive-intelligence for B2B go-to-market teams. Sightline watches
> competitors' public footprint, detects what _meaningfully_ changed, explains
> _why it matters_ with cited evidence and a confidence score, and turns intel
> into live, collaborative battlecards.

This repository is being built **phase by phase**. See
[`SIGHTLINE_PLAN.md`](./SIGHTLINE_PLAN.md) for strategy and
[`SIGHTLINE_BUILD_PROMPT.md`](./SIGHTLINE_BUILD_PROMPT.md) for the build brief.

---

## Status — Phase 3: Real-time collaboration ✅

Phases 0–2 plus Phase 3 (collaborative battlecards, comments, assignments,
role enforcement, suggest→approve) are complete.

**Phase 3 — Real-time collaboration**

- **Collaborative battlecards** per competitor on **Liveblocks + Yjs**: a
  CodeMirror editor with conflict-free concurrent editing, **live cursors**,
  and a **presence avatar stack**. Rooms are org-namespaced
  (`org:{orgId}:battlecard:{id}`) and the auth endpoint only ever grants the
  caller access to their **own org's** room pattern — tenant-isolated.
- **Comments** on changes (Review Queue) and on battlecards.
- **Assignment**: a change can be assigned to a teammate.
- **Role enforcement, server-side**: Owner/Admin/Member can edit; **Viewer is
  read-only** — enforced in the Liveblocks token (READ vs FULL access), in
  every server action (`assertAtLeast("member")`), and in the editor
  (`EditorState.readOnly`).
- **battlecard.suggest**: a high-impact change drafts a **pending** battlecard
  edit; a human **approves** (which inserts it into the editor) or **rejects** —
  never auto-applied.

> Not yet built: Stripe billing, AI cost dashboard UI, evals-in-CI, self-hosted
> Yjs (Hocuspocus).

---

Phase 0 (foundation) + Phase 1 (core loop) + Phase 2 (scheduled monitoring,
review queue, weekly digest, tracing) are complete.

**Phase 2 — Agentic + scheduled**

- **Inngest** scheduled monitoring: an hourly cron fans out a durable scan job
  per **due** source (respecting its `scan_frequency` + a hard **12h floor**).
  Manual "Scan now" still works. Scan stages are separate `step.run`s so a
  retry can't double-charge the AI APIs; an **unchanged content hash skips the
  analyze/embed steps entirely** (no change = no spend).
- **Review Queue**: changes with confidence `< 0.6` stay out of the feed and
  surface at `/app/review` for a human to **mark reviewed** or **dismiss**.
  AI is decision-support, never auto-authoritative.
- **Weekly digest** (Inngest cron, Mondays 09:00 UTC): per-org summary of the
  week's changes → `digests`, shown at `/app/digests`.
- **Langfuse** tracing on every AI call (traces, cost, latency), alongside the
  existing `ai_runs` logging; the Ask cost line is in the UI. Optional —
  no-ops when unconfigured.

> Not yet built (later phases): Liveblocks/Yjs battlecards, Stripe billing,
> the AI cost dashboard UI, evals-in-CI.

---

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
| `LIVEBLOCKS_SECRET_KEY`         | liveblocks.io → project → API keys (collaboration; optional for build) |

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

# 4. Apply RLS for the Phase 2 `digests` table.
psql "$DIRECT_URL" -f prisma/sql/0003_phase2.sql

# 5. Apply RLS for the Phase 3 collaboration tables.
psql "$DIRECT_URL" -f prisma/sql/0004_phase3.sql
```

> No `psql`? Paste each `prisma/sql/*.sql` file into the Supabase **SQL editor**
> and run it. The SQL files are idempotent.

### Background jobs (Inngest)

In local dev, run the Inngest dev server alongside `npm run dev` (no keys
needed):

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open the Inngest dev dashboard (http://localhost:8288) to see the
`scheduled-scan`, `scan-source`, and `weekly-digest` functions and to invoke
them manually. In production, set `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
and register `/api/inngest` from the Inngest dashboard.

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
