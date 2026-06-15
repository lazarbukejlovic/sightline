# Sightline

**AI competitive-intelligence for B2B go-to-market teams.** Sightline watches
your competitors' public footprint, detects what _meaningfully_ changed,
explains _why it matters_ with cited evidence and a confidence score, and turns
it into live, collaborative battlecards your whole team shares.

> **Live demo:** _add your Vercel URL here_ · **Walkthrough:** _add your Loom link here_

![hero screenshot placeholder](docs/hero.png)

---

## What it is

An always-on "intelligence command desk" for product and GTM teams. Add a
competitor, point Sightline at their public pages (pricing, changelog, blog,
news, careers), and it:

1. **Monitors** each source on a schedule (durable background jobs), snapshots
   the normalized text, and diffs it against the last snapshot.
2. **Explains** meaningful changes with an LLM — a summary, category, impact,
   a one-line _why it matters_, and a **confidence score**, every claim tied to
   a **redline of the exact diff**.
3. **Routes uncertainty to humans** — low-confidence findings land in a Review
   Queue before they ever reach the feed. AI is decision-support, never the
   final authority.
4. **Answers questions** over everything collected — _"How did Notion change
   pricing this quarter?"_ — with inline citations and the token cost shown.
5. **Shares** intel as real-time collaborative **battlecards** (presence, live
   cursors, comments), with AI-drafted edits a human approves.

## The problem

GTM teams lose deals to competitor moves they find out about too late — a
pricing change, a new integration, a positioning shift. The signal is public,
but nobody has time to watch every page. Generic LLM chat can't help: it has no
memory of what changed, no evidence, no confidence, and no shared workspace.

## Architecture

```
                            ┌──────────────────────────────────────────┐
   Browser (Next 15 RSC) ──▶│ Server Actions / Route Handlers           │
   • Intel Feed             │  • org_id resolved + verified per request │
   • Battlecard editor      │  • app-layer tenancy scope (every query)  │
   • Ask Sightline (stream) └───────────────┬──────────────────────────┘
        │  Liveblocks (Yjs)                  │ Prisma (privileged)
        ▼                                    ▼
   ┌───────────┐                  ┌────────────────────────────┐
   │ Liveblocks│                  │ Supabase Postgres + RLS     │
   │  rooms     │                 │  • pgvector (intel_chunks)  │
   │ org:{id}:* │                 │  • subscriptions, ai_runs,  │
   └───────────┘                  │    ai_feedback, changes …   │
                                  └───────┬────────────────────┘
   Inngest (cron + durable steps)        │
   • scheduled scan (12h floor)          │   Anthropic  (reasoning: summaries, Ask, suggestions)
   • change.analyze ▶ embed ─────────────┤   OpenAI     (embeddings only → pgvector)
   • weekly digest                       │   Firecrawl  (clean public-page fetch)
                                         │   Langfuse   (LLM traces / cost / latency)
   Stripe (test mode)  ──webhook──▶ subscriptions (plan, seats, status)
   • Checkout · Portal · metered AI usage (meter events)
```

**Two-layer multi-tenancy.** Postgres **RLS** keyed on `org_id` (via Supabase
JWT) for any client-key access, _and_ app-layer scoping: every server query is
filtered by an `org_id` resolved from the session — never trusted from the
client. See [`src/lib/org-scope.ts`](src/lib/org-scope.ts).

## Hard parts I solved

- **Multi-tenant isolation, two ways.** RLS policies (`prisma/sql/*.sql`) +
  app-layer `org_id` scoping, with tenant-isolated Liveblocks rooms
  (`org:{orgId}:*`) granted server-side so a user can never join another org's
  room.
- **Agentic monitoring that can't double-charge.** Each scan stage is an
  Inngest `step.run`, so a retry resumes without re-fetching, re-analyzing, or
  re-embedding what already succeeded. Unchanged content (same hash) skips the
  AI steps entirely — **no change = no spend** — under a hard 12h scan floor.
- **pgvector + Prisma without drift.** The `vector(1536)` column is modeled as
  `Unsupported(...)` so migrations never drop it; reads/writes use raw SQL with
  an HNSW index.
- **RAG with citations, confidence, and cost** — streamed answers with inline
  `[n]` citations and per-answer token cost, every call logged to `ai_runs`.
- **Real-time editing** — CodeMirror bound to a Yjs doc over Liveblocks
  (conflict-free, live cursors, presence) without losing persistence.

## Engineering judgment on AI (with numbers)

This is the part that matters most. AI here is a **measured, bounded,
human-supervised** system:

- **Every** AI call writes an `ai_runs` row (model, input/output tokens,
  cost, latency, Langfuse trace id). The **AI cost dashboard** (`/app/billing`)
  shows total spend, **cost per answer**, tokens, and avg latency by run type —
  real numbers, not adjectives.
- **Confidence routes work to humans.** Findings below a 0.6 confidence
  threshold ([`src/lib/constants.ts`](src/lib/constants.ts)) go to the **Review
  Queue**, never auto-published.
- **An eval loop measures quality.** Thumbs up/down + optional corrections on
  answers and change summaries write to `ai_feedback`; the dashboard surfaces an
  **acceptance rate** (thumbs-up share of rated output).
- **Cost is contained.** Cheap embeddings (OpenAI) vs. reasoning (Anthropic)
  are kept strictly separate; unchanged pages cost nothing; metered AI usage is
  reported to Stripe per answer.
- **Model roles are fixed:** Anthropic (`claude-opus-4-8` default) for all
  reasoning; OpenAI `text-embedding-3-small` for embeddings only.

> Replace these with your own measured figures after a demo run, e.g.
> _"cost/answer $0.01–$0.03, p95 answer latency ~Xs, acceptance rate Y%,
> N sources cited/answer."_

## Hardening (Phase 5)

- **Prompt evals in CI** — a golden set of change inputs + a tolerance scorer
  ([`src/lib/ai/evals`](src/lib/ai/evals)) run on every PR against cached
  cassettes (zero API spend); `EVAL_LIVE=1 npm run eval` runs the real prompt.
- **Playwright e2e** — public-surface smoke runs in CI; the full signed-in core
  loop (`e2e/core-loop.spec.ts`) is opt-in against a seeded deploy.
- **Rate limiting** — per-org/user on scan + Ask (Upstash Redis, in-memory
  fallback), with clear 429s.
- **Multi-model routing + caching** — change classification + battlecard drafts
  use a cheaper model (`ANTHROPIC_FAST_MODEL`); repeat Ask answers are cached
  org-scoped. Anthropic stays for high-stakes reasoning; OpenAI embeddings-only.
- **Audit log** — owner/admin-only `/app/audit` over the `audit_log` table.
- **Public status page** — `/status` (aggregate, non-sensitive metrics).

## What's next

Self-hosted Yjs (Hocuspocus) instead of Liveblocks — see
[`docs/phase5-hocuspocus.md`](docs/phase5-hocuspocus.md) for the plan + parity
gate (kept Liveblocks until verified) · a **public read-only demo org** route
(no signup) · multi-model response-quality routing · a public metrics history.

---

## Tech stack

Next.js 15 (App Router, RSC, Server Actions) · React 19 · TypeScript (strict) ·
Tailwind v4 + Framer Motion · Supabase (Postgres, Auth, RLS, pgvector) · Prisma ·
Inngest · Anthropic (Vercel AI SDK) · OpenAI embeddings · Firecrawl · Liveblocks
+ Yjs + CodeMirror · Langfuse · Stripe (test mode) · Vitest · GitHub Actions CI.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values (see .env.example for each)
```

### Database

```bash
npx prisma db push                                   # create/sync all tables
psql "$DIRECT_URL" -f prisma/sql/0001_rls_and_triggers.sql   # RLS + auth→profile trigger
psql "$DIRECT_URL" -f prisma/sql/0002_phase1.sql            # pgvector + embedding col + HNSW
psql "$DIRECT_URL" -f prisma/sql/0003_phase2.sql            # digests RLS
psql "$DIRECT_URL" -f prisma/sql/0004_phase3.sql            # collaboration RLS
psql "$DIRECT_URL" -f prisma/sql/0005_phase4.sql            # billing + feedback RLS
psql "$DIRECT_URL" -f prisma/sql/0006_phase5.sql            # audit-log RLS
```

(No `psql`? Paste each `prisma/sql/*.sql` into the Supabase SQL editor — they're
idempotent.)

### Demo data (optional)

```bash
npm run seed:demo            # creates a "Sightline Demo" org with sample intel
```

Or, signed in to an empty workspace, click **Load sample intel** on the feed.

### Stripe (test mode)

Use **test keys only**. In the Stripe dashboard (Test mode):

1. Create products + recurring **per-seat** prices → set `STRIPE_PRO_PRICE_ID`,
   `STRIPE_TEAM_PRICE_ID`.
2. Create a **metered** price backed by a Billing **Meter** (event name e.g.
   `ai_answer`) → set `STRIPE_AI_USAGE_PRICE_ID` + `STRIPE_AI_USAGE_METER_EVENT`.
3. Forward webhooks locally and copy the printed signing secret:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   # → whsec_...  →  STRIPE_WEBHOOK_SECRET
   ```
4. Test card: **`4242 4242 4242 4242`**, any future expiry, any CVC/ZIP.

### Run

```bash
npm run dev                  # app at http://localhost:3000
npx inngest-cli@latest dev   # (optional) Inngest dev server for scheduled jobs
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next dev / production build (runs `prisma generate` first) / start |
| `npm run lint` · `typecheck` · `test` | ESLint · `tsc --noEmit` · Vitest (incl. prompt evals) |
| `npm run eval` | Prompt evals (set `EVAL_LIVE=1` to hit the model) |
| `npm run e2e` · `e2e:smoke` | Playwright e2e (all / public smoke) |
| `npm run seed:demo` | Seed the standalone demo org |
| `npm run prisma:generate` · `prisma:migrate` | Prisma client / dev migration |
