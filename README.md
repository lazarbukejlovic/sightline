# Sightline

> AI competitive-intelligence for B2B go-to-market teams. Sightline watches
> competitors' public footprint, detects what _meaningfully_ changed, explains
> _why it matters_ with cited evidence and a confidence score, and turns intel
> into live, collaborative battlecards.

This repository is being built **phase by phase**. See
[`SIGHTLINE_PLAN.md`](./SIGHTLINE_PLAN.md) for strategy and
[`SIGHTLINE_BUILD_PROMPT.md`](./SIGHTLINE_BUILD_PROMPT.md) for the build brief.

---

## Status — Phase 0: Foundation ✅

Phase 0 establishes the production skeleton:

- **Next.js 15** (App Router) · **React 19** · **TypeScript (strict)**
- **Tailwind CSS v4** design system — "intelligence briefing", light-first
- **Framer Motion** for meaningful motion
- **Supabase Auth** foundation (`@supabase/ssr`) — sign-up / sign-in / sign-out
- **Prisma** schema for identity & tenancy (`Profile`, `Organization`,
  `Membership`) + raw SQL for **RLS** policies and the auth→profile trigger
- App-layer multi-tenancy guard (`src/lib/org-scope.ts`) with unit tests
- Premium landing page, protected `/app` overview
- **GitHub Actions** CI (lint · typecheck · test) + **Vitest**

> Not yet built (later phases): Firecrawl, Inngest, Stripe, Liveblocks,
> Langfuse, Anthropic/OpenAI, pgvector, Ask Sightline, scan jobs, battlecards.

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

### Database setup

```bash
npm run prisma:migrate           # create tables from prisma/schema.prisma
psql "$DIRECT_URL" -f prisma/sql/0001_rls_and_triggers.sql   # RLS + trigger
```

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
