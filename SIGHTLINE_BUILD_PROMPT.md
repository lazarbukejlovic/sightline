# Sightline — Master Build Prompt

> Paste this into your AI coding agent (Cursor / Claude Code / Copilot Chat) in VS Code. It is written to be handed to the agent as the project brief. Build **phase by phase** — do not scaffold everything at once. Keep the build green after every phase.

---

You are acting as a **senior full-stack engineer, product designer, and creative director**. We are building a real, production-grade B2B SaaS called **Sightline** that I will deploy live and put at the center of my portfolio. Treat this as a real product, not a demo toy.

## Product

**Sightline** is an AI competitive-intelligence platform for B2B go-to-market teams. It watches competitors' public footprint (pricing pages, changelogs, blogs, news, review sites, careers pages), detects what *meaningfully* changed, explains *why it matters* with cited evidence and a confidence score, routes uncertain findings to humans, and turns intel into **live, collaborative battlecards** the whole team shares. It also offers **Ask Sightline**, a RAG chat over collected intel that always shows citations, confidence, and token cost.

The product purpose must be obvious within 10 seconds of landing or logging in: the user immediately sees a live **Intel Feed** of competitor change cards.

## Non-negotiable working rules

- **Inspect before you change.** Read the current project state before editing. Preserve existing functionality; never delete working code to "start fresh" without asking.
- **TypeScript strict, always.** No `any` unless justified in a comment. Keep types clean and the typecheck green.
- **Run and fix the build before finishing any task.** Lint, typecheck, and tests must pass. Fix what you break.
- **Never expose or hardcode secrets.** All keys via env vars. Commit a `.env.example`, never a real `.env`.
- **No unnecessary dependencies.** Justify every new package. Prefer the platform and the stack below.
- **Production-quality UI/UX, not generic SaaS.** Distinctive, premium, strong typography and visual hierarchy, meaningful motion, excellent contrast, fully responsive, realistic product copy (never lorem ipsum). Do **not** build a generic dark AI dashboard.
- **Work incrementally and verifiably.** After each phase, the app must run end-to-end and deploy. Pause and summarize what to verify.
- **Security as a senior would:** enforce multi-tenant isolation at the DB (RLS) *and* in app code; only monitor public pages; rate-limit external fetches; respect robots.

## Tech stack (use exactly this unless you flag a strong reason)

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS + shadcn/ui + Framer Motion
- Supabase: Postgres + Auth + RLS + Storage + **pgvector** + Realtime
- Prisma for schema + migrations + typed server queries
- **Inngest** for background jobs, cron monitoring, and multi-step agent workflows (retries, observability)
- **Anthropic API** via the **Vercel AI SDK** (streaming + structured/tool outputs)
- Embeddings: OpenAI `text-embedding-3-small` → pgvector (HNSW index)
- **Firecrawl** for page fetching; Playwright worker as fallback for JS-heavy pages
- **Liveblocks + Yjs** for real-time collaborative battlecards (presence, cursors, comments)
- **Stripe** for billing (seats + metered usage + webhooks + customer portal)
- **Langfuse** for LLM tracing/cost/latency
- Deploy: Vercel (web + Inngest) + Supabase. CI: GitHub Actions (lint, typecheck, Vitest, Playwright)
- Testing: Vitest (unit/integration) + Playwright (e2e)

## Multi-tenancy (do this correctly)

Every domain table has an `org_id`. Enforce isolation at two layers: (1) Postgres **RLS** policies keyed on `org_id` from the Supabase JWT for any client-reachable access; (2) in server code, always resolve and verify the authenticated user's `org_id` and scope every query by it — never trust a client-supplied org id. Write an integration test proving a user in org A cannot read org B's data.

## Data model

Implement these Prisma models (refine names/fields as needed, keep the shape): `organizations`, `memberships(role: owner|admin|member|viewer)`, `profiles`, `competitors`, `sources(type, url, scan_frequency, is_active, last_scanned_at)`, `source_snapshots(content_text, content_hash, fetched_at)`, `changes(summary, why_it_matters, category, impact, confidence, diff_excerpt, snapshot_before_id, snapshot_after_id, status)`, `intel_chunks(content, embedding vector(1536))`, `battlecards`, `comments`, `assignments`, `ai_runs(model, input_tokens, output_tokens, cost_usd, latency_ms, trace_id, type)`, `ai_feedback`, `digests`, `subscriptions`, `usage_events`, `audit_log`. Index `changes(org_id, detected_at desc)` and an HNSW index on `intel_chunks.embedding`.

## Agent / background design

AI is **decision-support, never the final authority**. Every AI call logs an `ai_runs` row (model, tokens, cost, latency, trace) and is traced in Langfuse. Inngest functions:
- `monitor.scan` (cron per source + manual trigger): fetch → normalize → hash → on change, snapshot → emit `change.detected`.
- `change.analyze`: structured LLM output → `summary, category, impact, confidence, why_it_matters`. If `confidence < 0.6`, flag for the human **Review Queue**.
- `intel.embed`: chunk + embed the delta into `intel_chunks`.
- `battlecard.suggest`: high-impact changes produce a *pending* battlecard suggestion a human approves — never auto-apply.
- `digest.weekly`: per-org weekly summary.
- `ask` (RAG, streamed): embed question → org-scoped pgvector retrieval → answer with **inline citations + confidence + token cost shown in the UI**.

## Design system (premium "intelligence briefing", not generic SaaS)

- Base: warm paper white `#FAF9F6`, near-black ink `#16150F`, generous whitespace, contrast targeting Lighthouse a11y > 95. Provide dark mode; light is the hero.
- Signal accent for high-impact / change-detected: a sharp red/amber (`#E5484D`). Calm secondary (deep teal) for reviewed/on-track. Confidence shown as a red→amber→green meter, never a bare number.
- Type: a distinctive display face for competitor names + big numbers (e.g. a sharp serif like Instrument Serif/Newsreader, or a strong grotesque), a clean sans for body (Inter/Geist), and **monospace** for all metadata (timestamps, diffs, token cost, URLs).
- Layout: 3-pane workspace — left nav (competitors/sources + last-scanned times), center (Intel Feed / change detail with redline-style diff / battlecard editor), right **Evidence panel** (sources, confidence, token cost, scoped "Ask Sightline").
- Motion (meaningful only): change cards settle into the feed; confidence meters fill; diffs sweep-highlight on open; AI answers stream in with citations resolving; smooth Liveblocks presence cursors.
- Landing page is the storefront: bold value headline, a 60-second looping/interactive demo of a change being detected, a Detect/Explain/Share feature trio, pricing, realistic copy.

## Build order — do these in sequence, each ending deployed and green

**Phase 0 — Foundation.** Scaffold Next.js 15 + TS strict + Tailwind + shadcn + ESLint/Prettier. GitHub Actions for lint/typecheck/test. Supabase project, Prisma schema + first migration, RLS policies, Supabase Auth. Build the design system (tokens, theme, fonts) and a polished **landing page + sign-up**. Deploy to Vercel. Stop and report.

**Phase 1 — Core loop (demoable).** Org + membership. Add competitor → add source → manual **"Scan now"** → Firecrawl fetch → snapshot → LLM change summary card in the feed with citation + confidence. Basic **Ask Sightline** RAG over snapshots (streamed, cited, cost shown). Stop and report.

**Phase 2 — Agentic + scheduled.** Move scanning to Inngest cron. Diffing + classification (category/impact/confidence/why) + **Review Queue** for low-confidence. Weekly digest. Langfuse tracing + `ai_runs` logging. Stop and report.

**Phase 3 — Real-time collaboration.** Liveblocks + Yjs collaborative battlecards: presence, live cursors, comments, assignment of changes to teammates, role enforcement (Viewer read-only). `battlecard.suggest` pending-approval flow. Stop and report.

**Phase 4 — Business + polish.** Stripe seats + metered AI usage + webhooks + customer portal. AI cost dashboard from `ai_runs`. `ai_feedback` thumbs + corrections loop. Onboarding, empty states, a seeded demo org tracking real public companies, and a case-study README with architecture diagram + live URL + Loom. Stop and report.

**Phase 5 — Senior level-ups (as time allows).** Self-host Yjs (Hocuspocus); prompt evals in CI (golden set → assert classification quality); rate limiting; multi-model routing + response caching; audit-log UI; Playwright e2e over the full core loop; public metrics page.

## Start now

Begin with **Phase 0 only**. First, propose the exact folder structure, the `package.json` dependencies (with a one-line justification each), the Prisma schema, the env var list (`.env.example`), and the design tokens. Wait for my confirmation, then scaffold, then deploy Phase 0. Do not start Phase 1 until Phase 0 runs and deploys cleanly.
