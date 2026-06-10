-- ============================================================================
-- Sightline — Phase 2 migration (scheduled monitoring artifacts)
--
-- Apply AFTER `npx prisma db push` has created the `digests` table and altered
-- `sources.scan_frequency` default to 'daily'. Run in the Supabase SQL editor
-- or:  psql "$DIRECT_URL" -f prisma/sql/0003_phase2.sql
--
-- Adds RLS for the new `digests` table (DB-level half of multi-tenancy).
-- Idempotent. Reuses helpers from 0001_rls_and_triggers.sql.
-- ============================================================================

alter table public.digests enable row level security;

-- Members of the owning org may read their digests. Digests are written by the
-- server (Inngest) via a privileged connection that bypasses RLS, so no client
-- write policy is needed.
drop policy if exists "digests_select_member" on public.digests;
create policy "digests_select_member" on public.digests
  for select using (public.is_org_member(org_id));

-- ============================================================================
-- End Phase 2 migration.
-- ============================================================================
