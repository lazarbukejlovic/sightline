-- ============================================================================
-- Sightline — Phase 1 security & pgvector migration
--
-- Apply AFTER the Phase 1 tables exist (run `npx prisma db push` or
-- `npx prisma migrate dev` first to create competitors, sources,
-- source_snapshots, changes, intel_chunks, ai_runs). Then run this file in the
-- Supabase SQL editor or:  psql "$DIRECT_URL" -f prisma/sql/0002_phase1.sql
--
-- This adds the pieces Prisma cannot manage natively:
--   1. the pgvector extension + the intel_chunks.embedding column + HNSW index
--   2. RLS policies for every Phase 1 table (DB-level half of multi-tenancy)
-- Idempotent — safe to re-run. Reuses the helpers from 0001_rls_and_triggers.sql
-- (public.is_org_member / public.current_user_org_ids).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pgvector: extension, embedding column, HNSW index for cosine search.
-- ----------------------------------------------------------------------------
create extension if not exists vector;

alter table public.intel_chunks
  add column if not exists embedding vector(1536);

-- HNSW index for fast approximate nearest-neighbor (cosine distance).
create index if not exists intel_chunks_embedding_hnsw
  on public.intel_chunks
  using hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on every Phase 1 table.
-- ----------------------------------------------------------------------------
alter table public.competitors      enable row level security;
alter table public.sources          enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.changes          enable row level security;
alter table public.intel_chunks     enable row level security;
alter table public.ai_runs          enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Policies. Reads: any member of the owning org. Writes: members with a
--    role of member or higher (owner/admin/member). The app server uses a
--    privileged connection that BYPASSES RLS and scopes by org_id in code
--    (src/lib/org-scope.ts); these policies are defense-in-depth for any
--    access that arrives via the anon/authenticated Supabase key.
-- ----------------------------------------------------------------------------

-- helper expression reused below: a writer must be owner/admin/member
--   exists (select 1 from memberships m
--           where m.org_id = <table>.org_id and m.user_id = auth.uid()
--             and m.role in ('owner','admin','member'))

-- competitors -----------------------------------------------------------------
drop policy if exists "competitors_select_member" on public.competitors;
create policy "competitors_select_member" on public.competitors
  for select using (public.is_org_member(org_id));

drop policy if exists "competitors_write_member" on public.competitors;
create policy "competitors_write_member" on public.competitors
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = competitors.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = competitors.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- sources ---------------------------------------------------------------------
drop policy if exists "sources_select_member" on public.sources;
create policy "sources_select_member" on public.sources
  for select using (public.is_org_member(org_id));

drop policy if exists "sources_write_member" on public.sources;
create policy "sources_write_member" on public.sources
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = sources.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = sources.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- source_snapshots ------------------------------------------------------------
drop policy if exists "source_snapshots_select_member" on public.source_snapshots;
create policy "source_snapshots_select_member" on public.source_snapshots
  for select using (public.is_org_member(org_id));

drop policy if exists "source_snapshots_write_member" on public.source_snapshots;
create policy "source_snapshots_write_member" on public.source_snapshots
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = source_snapshots.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = source_snapshots.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- changes ---------------------------------------------------------------------
drop policy if exists "changes_select_member" on public.changes;
create policy "changes_select_member" on public.changes
  for select using (public.is_org_member(org_id));

drop policy if exists "changes_write_member" on public.changes;
create policy "changes_write_member" on public.changes
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = changes.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = changes.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- intel_chunks ----------------------------------------------------------------
drop policy if exists "intel_chunks_select_member" on public.intel_chunks;
create policy "intel_chunks_select_member" on public.intel_chunks
  for select using (public.is_org_member(org_id));

drop policy if exists "intel_chunks_write_member" on public.intel_chunks;
create policy "intel_chunks_write_member" on public.intel_chunks
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = intel_chunks.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = intel_chunks.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- ai_runs (server-written only; members may read for the cost view) -----------
drop policy if exists "ai_runs_select_member" on public.ai_runs;
create policy "ai_runs_select_member" on public.ai_runs
  for select using (public.is_org_member(org_id));

-- ============================================================================
-- End Phase 1 migration.
-- ============================================================================
