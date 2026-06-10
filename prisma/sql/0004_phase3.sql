-- ============================================================================
-- Sightline — Phase 3 migration (collaboration: RLS for new tables)
--
-- Apply AFTER `npx prisma db push` has created the Phase 3 tables
-- (battlecards, comments, assignments, battlecard_suggestions). Run in the
-- Supabase SQL editor or:  psql "$DIRECT_URL" -f prisma/sql/0004_phase3.sql
--
-- DB-level half of multi-tenancy. The app server writes via a privileged
-- connection that bypasses RLS and scopes by org_id in code; these policies are
-- defense-in-depth for any access via the anon/authenticated Supabase key.
-- Idempotent. Reuses helpers from 0001_rls_and_triggers.sql.
-- ============================================================================

alter table public.battlecards            enable row level security;
alter table public.comments               enable row level security;
alter table public.assignments            enable row level security;
alter table public.battlecard_suggestions enable row level security;

-- battlecards -----------------------------------------------------------------
drop policy if exists "battlecards_select_member" on public.battlecards;
create policy "battlecards_select_member" on public.battlecards
  for select using (public.is_org_member(org_id));

drop policy if exists "battlecards_write_member" on public.battlecards;
create policy "battlecards_write_member" on public.battlecards
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = battlecards.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = battlecards.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- comments --------------------------------------------------------------------
drop policy if exists "comments_select_member" on public.comments;
create policy "comments_select_member" on public.comments
  for select using (public.is_org_member(org_id));

drop policy if exists "comments_write_member" on public.comments;
create policy "comments_write_member" on public.comments
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = comments.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = comments.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- assignments -----------------------------------------------------------------
drop policy if exists "assignments_select_member" on public.assignments;
create policy "assignments_select_member" on public.assignments
  for select using (public.is_org_member(org_id));

drop policy if exists "assignments_write_member" on public.assignments;
create policy "assignments_write_member" on public.assignments
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = assignments.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = assignments.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- battlecard_suggestions ------------------------------------------------------
drop policy if exists "battlecard_suggestions_select_member" on public.battlecard_suggestions;
create policy "battlecard_suggestions_select_member" on public.battlecard_suggestions
  for select using (public.is_org_member(org_id));

drop policy if exists "battlecard_suggestions_write_member" on public.battlecard_suggestions;
create policy "battlecard_suggestions_write_member" on public.battlecard_suggestions
  for all
  using (exists (select 1 from public.memberships m
                 where m.org_id = battlecard_suggestions.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')))
  with check (exists (select 1 from public.memberships m
                 where m.org_id = battlecard_suggestions.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin','member')));

-- ============================================================================
-- End Phase 3 migration.
-- ============================================================================
