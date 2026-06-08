# Sightline — Product, Engineering & Design Plan

> **Working name:** Sightline. Alternatives if you want a different vibe: *Vantage, Recon, Frontline, Lookout, Beacon.*
> **One-liner:** AI competitive-intelligence for B2B go-to-market teams. Sightline watches your competitors' public footprint, detects what meaningfully changed, explains *why it matters* with cited evidence + a confidence score, and turns it into live, collaborative battlecards your whole team shares.

This document is the strategy, architecture, data model, design system, and build roadmap. The companion file `SIGHTLINE_BUILD_PROMPT.md` is the master prompt you paste into your AI coding agent.

---

## 1. Why this project (the interview narrative)

Most portfolio projects in 2026 fail because they are (a) solo-productivity clones, (b) AI chatbot wrappers, or (c) localhost-only with no production concerns. The 2026 bar for a senior-leaning full-stack engineer is: **AI used with engineering judgment** (sources, confidence, cost controls), plus the production signals that prove you can ship for a team — real-time collaboration, background/agentic workflows, multi-tenancy with RLS, billing, and observability.

Sightline is engineered to force every one of those signals while remaining a *believable real business*:

- **Real market.** Competitive intelligence is a funded category (Klue, Crayon, Kompyte). The "this could be sold for millions" story is credible, not hand-wavy.
- **Vertical, not horizontal.** It is a scalpel — one job done exceptionally for one buyer (GTM/product leaders) — which is exactly where 2026 SaaS money is.
- **Demoable.** A live "intel feed" of real change cards is visually compelling in the first 10 seconds. You can seed a demo org tracking *public* companies' *public* pages — no privacy issues, believable data.
- **Differentiated from your other three projects** — team B2B, multiplayer, always-on, agentic.

**The moat you say out loud in interviews:** a normalized, time-series *change history* of competitors + a collaborative battlecard layer + an eval/feedback loop that measurably improves answer quality. A generic LLM chat has none of these.

**Metrics to instrument from day one** (so your README and interviews use numbers, not adjectives): demo signups, weekly active orgs, cost per AI answer (e.g. `$0.0x`), p95 answer latency, % AI answers accepted vs. edited by humans, sources cited per answer.

---

## 2. What it does (feature surface)

**Core loop**
1. Add a competitor → add sources (pricing page, changelog, blog, news, review site, careers page).
2. Sightline scans sources on a schedule, snapshots them, and diffs against the last snapshot.
3. When something meaningful changed, an agent summarizes the change, classifies it (pricing / product / positioning / hiring / funding), scores **impact** and **confidence**, and writes a one-line *"why this matters."*
4. Changes stream into a shared **Intel Feed**. Low-confidence items land in a **Review Queue** for a human (AI is decision-support, never the final authority).
5. The team maintains **collaborative battlecards** per competitor (real-time, multiplayer). The agent *suggests* battlecard edits from new intel; a human approves.
6. **Ask Sightline** — a RAG chat over all collected intel: "How did Acme change pricing this quarter?" → cited, confidence-scored answer with the token cost shown.
7. Weekly **digest** per org (in-app + optional email).

**Roles:** Owner, Admin, Member, Viewer. Multi-tenant by organization.

**Monetization (for the demo, real Stripe test mode):** Free (1 competitor, manual scans), Pro (seats + scheduled monitoring + digests), metered AI usage on top.

---

## 3. Tech stack (maps to your strengths, plus 2–3 senior-signal additions)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript (strict)** | Your core stack. Server Actions + RSC for clean data flow. |
| Styling | **Tailwind + shadcn/ui + Framer Motion** | Premium, distinctive UI with meaningful motion. |
| DB / Auth / Storage | **Supabase (Postgres + Auth + RLS + Storage + pgvector + Realtime)** | Your stack. RLS = the multi-tenancy senior signal. pgvector = RAG without extra infra. |
| ORM / migrations | **Prisma** for schema + migrations + typed server queries | Your stack. See RLS note below. |
| Background / agents | **Inngest** (durable functions, cron, retries, step orchestration) | The senior signal. Scheduled monitoring + multi-step agent runs with automatic retries and observability. |
| AI | **Anthropic API** (you've shipped this in Flowstate) via **Vercel AI SDK** for streaming + structured outputs (tool calling / JSON schema) | Streaming answers, structured change classification. |
| Embeddings + RAG | OpenAI `text-embedding-3-small` (or Voyage) → **pgvector** | Cheap, fast, in your existing DB. |
| Web fetch / monitoring | **Firecrawl API** for clean page content; **Playwright** worker as fallback for JS-heavy pages | Robust ingestion; diff on normalized text. |
| Real-time collaboration | **Liveblocks + Yjs** for collaborative battlecards (presence, cursors, comments) | Ships fast and looks premium. *Level-up:* self-host Yjs via Hocuspocus on a worker — call this out as a stretch goal. |
| Billing | **Stripe** (seats + metered usage, webhooks) | Your stack. Seats + metering = real SaaS billing, not a toy. |
| LLM observability | **Langfuse** (or Helicone) for traces + cost + latency | Proves you treat AI as a measurable system. |
| Deploy / CI | **Vercel** (web + Inngest) + Supabase; **GitHub Actions** (lint, typecheck, Vitest, Playwright e2e) | Live URL + green CI is an explicit 2026 hiring signal. |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Tests on PRs set you apart. |

**RLS + Prisma note (do this correctly — it's a talking point):** Enforce tenant isolation at *two* layers. (1) Postgres **RLS policies** keyed on `org_id` via Supabase JWT claims for anything reachable by a client/anon key (defense in depth). (2) In server code, always scope queries by the authenticated user's `org_id` — never trust the client to pass it. Use Prisma with the service role on the server *only* inside handlers that have already resolved and verified `org_id`. Add an integration test that proves user A cannot read org B's data.

---

## 4. Data model (core tables)

```
organizations(id, name, slug, plan, created_at)
memberships(id, org_id, user_id, role[owner|admin|member|viewer], created_at)
profiles(id=auth.user, full_name, avatar_url)

competitors(id, org_id, name, domain, logo_url, created_at)
sources(id, competitor_id, org_id, type[pricing|changelog|blog|news|reviews|jobs|custom],
        url, scan_frequency, is_active, last_scanned_at)
source_snapshots(id, source_id, org_id, content_text, content_hash, fetched_at, raw_url)

changes(id, source_id, competitor_id, org_id, summary, why_it_matters,
        category[pricing|product|positioning|hiring|funding|other],
        impact[low|medium|high], confidence numeric(3,2),
        diff_excerpt, snapshot_before_id, snapshot_after_id,
        status[new|reviewed|dismissed|promoted], detected_at)

intel_chunks(id, org_id, competitor_id, source_snapshot_id, content, embedding vector(1536), created_at)

battlecards(id, competitor_id, org_id, title, yjs_doc bytea|liveblocks_room_id,
            status[draft|published], updated_by, updated_at)
comments(id, org_id, target_type[change|battlecard], target_id, author_id, body, created_at)
assignments(id, org_id, change_id, assignee_id, status, created_at)

ai_runs(id, org_id, type[change_analyze|ask|battlecard_suggest|digest], model,
        input_tokens, output_tokens, cost_usd, latency_ms, status, trace_id, created_at)
ai_feedback(id, org_id, ai_run_id, rating[up|down], corrected_output, created_at)

digests(id, org_id, period_start, period_end, summary, created_at)

subscriptions(id, org_id, stripe_customer_id, stripe_subscription_id, plan, seats, status)
usage_events(id, org_id, kind[ai_answer|scan], quantity, occurred_at)  -- for metered billing
audit_log(id, org_id, actor_id, action, target, metadata jsonb, created_at)
```

Index `intel_chunks.embedding` with an HNSW index. Index `changes(org_id, detected_at desc)` for the feed.

---

## 5. Agent & background architecture (Inngest functions)

Keep the AI as **decision-support**: it drafts, scores confidence, and routes low-confidence work to humans. Never let it silently overwrite human-owned content.

| Function | Trigger | Steps |
|---|---|---|
| `monitor.scan` | Cron per source frequency, or manual "Scan now" event | Firecrawl fetch → normalize text → hash → if hash changed, write `source_snapshot` → emit `change.detected` |
| `change.analyze` | `change.detected` | LLM diff summarization (structured output: summary, category, impact, confidence, why_it_matters) → write `changes` → emit `intel.embed`. If `confidence < 0.6` → `status=new` + flag for Review Queue |
| `intel.embed` | after analyze | Chunk + embed snapshot delta → upsert `intel_chunks` |
| `battlecard.suggest` | high-impact change | Draft a suggested battlecard edit → store as a *pending suggestion* a human approves (never auto-apply) |
| `digest.weekly` | Cron weekly per org | Aggregate week's changes → LLM summary → write `digests` → optional email |
| `ask` (RAG) | API route, streamed | Embed question → pgvector retrieve top-k chunks (filtered by org_id) → answer with **inline citations + confidence + token cost** → log `ai_run` |

Every AI call writes an `ai_runs` row (model, tokens, cost, latency, trace_id) and is traced in Langfuse. The "Ask" answer UI shows cost and citations — this *is* the engineering-judgment signal reviewers look for.

---

## 6. Design direction (this is a differentiator — make it premium, not generic SaaS)

**Positioning visible in 10 seconds:** the moment the app loads, the user sees a live **Intel Feed** of change cards with competitor logos, category tags, confidence meters, and "why it matters" lines. It reads instantly as *"a radar for my competitors."*

**Aesthetic: "Intelligence briefing," not "AI dashboard."** Editorial meets ops. Avoid the default indigo/violet SaaS look and dark generic AI dashboards.

**Type**
- Display / headings: a confident grotesque or a sharp modern serif for big numbers and competitor names (e.g. *Söhne / Newsreader / Instrument Serif* vibe — pick one with a real personality).
- Body: a clean neutral sans (Inter / Geist).
- **Monospace** for metadata: timestamps, diffs, token costs, source URLs. This single choice makes it feel like a real intelligence tool.

**Color**
- Base: warm paper white (`#FAF9F6`) with near-black ink (`#16150F`), generous whitespace, strong contrast (target Lighthouse a11y > 95).
- One high-voltage signal accent for "change detected" / high impact (a signal amber or a sharp red, e.g. `#E5484D`).
- A calm secondary (deep teal/green) for "reviewed / on-track."
- Confidence rendered as a small meter (red→amber→green), never a bare number alone.
- Provide a dark mode, but light is the hero.

**Layout: a 3-pane workspace**
- Left: competitors + sources nav, with live "last scanned" times.
- Center: the Intel Feed, a change detail (with a **redline-style diff**), or a battlecard editor.
- Right: the **Evidence panel** — sources, confidence, token cost, and an "Ask Sightline" box scoped to the current competitor.

**Motion (meaningful, not decorative)**
- New change cards slide/settle into the feed.
- Confidence meters fill on mount.
- Diff highlights sweep on open.
- Streamed AI answers type in; citations pop in as they resolve.
- Liveblocks presence: smooth live cursors + avatar stack on battlecards.

**Landing page** (your storefront — it is the most-judged surface): a bold headline that states the value, a 60-second interactive/looped demo of a change being detected, a feature trio (Detect / Explain / Share), pricing, and realistic copy. No lorem ipsum, ever.

---

## 7. Build roadmap (ship something live early, then deepen)

Each phase ends with a deployed, working state. Don't move on until the build is green and the phase demos end-to-end.

**Phase 0 — Foundation (live landing + auth).**
Repo + strict TS + ESLint/Prettier + GitHub Actions (lint/typecheck/test). Supabase project, Prisma schema + first migration, RLS policies, Supabase Auth. Design system (tokens, shadcn theme, fonts). Ship the **landing page** + sign-up live on Vercel.

**Phase 1 — Core loop, demoable.**
Org creation + membership. Add competitor → add source URL → manual **"Scan now"** (synchronous for now) → Firecrawl fetch → snapshot → LLM change summary card in the feed *with citation + confidence*. Basic **Ask Sightline** (RAG over snapshots). This phase alone is a strong demo.

**Phase 2 — Agentic + scheduled.**
Move scanning to **Inngest** cron per source. Diffing + change classification + impact/confidence + "why it matters." **Review Queue** for low-confidence items. Weekly **digest**.

**Phase 3 — Real-time collaboration.**
Collaborative **battlecards** (Liveblocks + Yjs): presence, live cursors, comments, assignment of changes to teammates. Roles enforced (Viewer can't edit). This is your multiplayer / "shared between users" headline feature.

**Phase 4 — Business + polish.**
**Stripe** seats + metered AI usage + webhooks + customer portal. **AI cost dashboard** (from `ai_runs`). **Eval/feedback loop** (`ai_feedback`, thumbs + corrections). Langfuse tracing. Onboarding, empty states, a seeded **demo org** tracking real public companies, a Loom walkthrough, and a **case-study README**.

**Phase 5 — Senior level-ups (do as many as time allows; each is an interview talking point).**
Self-hosted Yjs (Hocuspocus) instead of Liveblocks · prompt **evals in CI** (golden set of change inputs → assert classification quality) · rate limiting + abuse protection · multi-model routing + response caching · audit log UI · Playwright e2e covering the full core loop · a public status/metrics page.

---

## 8. The case-study README (write this — it's half the impact)

Structure your repo README as a product case study, not a setup guide:
1. **What it is** + a hero screenshot/GIF + the live demo URL + a Loom link.
2. **The problem** (GTM teams lose deals because they don't know what competitors changed).
3. **Architecture diagram** (web ↔ Supabase ↔ Inngest agents ↔ Anthropic ↔ pgvector).
4. **Hard parts I solved**: multi-tenant RLS, agentic monitoring with retries, RAG with citations + confidence + cost, real-time collaboration.
5. **Engineering judgment on AI**: how confidence routes work to humans, how cost is tracked, the eval loop, with numbers.
6. **What I'd do next** (the Phase 5 list) — shows senior product thinking.
Put the setup instructions at the bottom.

---

## 9. Risks & how to defuse them (so you sound senior, not naive)

- **Scraping ToS / legality:** only monitor public pages; respect robots; never store credentials; rate-limit politely. Say this proactively.
- **AI hallucination:** every answer is cited and confidence-scored; low confidence routes to humans; you measure acceptance rate.
- **Cost runaway:** per-org usage caps, cheap embeddings, caching, cost shown in UI and tracked per run.
- **Demo data:** seed a public-company demo org so reviewers see real value without signing up.

---

*Next: open `SIGHTLINE_BUILD_PROMPT.md` and paste it into your AI coding agent. Build Phase 0 → 1 fully working before moving on.*
