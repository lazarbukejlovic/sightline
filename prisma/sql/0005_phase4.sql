-- ============================================================================
-- Sightline — Phase 4 migration (billing + eval/feedback: RLS)
--
-- Apply AFTER `npx prisma db push` has created the Phase 4 tables
-- (subscriptions, ai_feedback). Run in the Supabase SQL editor or:
--   psql "$DIRECT_URL" -f prisma/sql/0005_phase4.sql
--
-- DB-level half of multi-tenancy. The app server (Prisma) and the Stripe
-- webhook write via a privileged connection that bypasses RLS and scopes by
-- org_id in code; these policies are defense-in-depth for the anon/auth key.
-- Idempotent. Reuses helpers from 0001_rls_and_triggers.sql.
-- ============================================================================

alter table public.subscriptions enable row level security;
alter table public.ai_feedback   enable row level security;

-- subscriptions — members may read their org's plan/seat state. Writes happen
-- server-side only (Stripe webhook), so no client write policy is granted.
drop policy if exists "subscriptions_select_member" on public.subscriptions;
create policy "subscriptions_select_member" on public.subscriptions
  for select using (public.is_org_member(org_id));

-- ai_feedback — members may read aggregate feedback and submit their own.
drop policy if exists "ai_feedback_select_member" on public.ai_feedback;
create policy "ai_feedback_select_member" on public.ai_feedback
  for select using (public.is_org_member(org_id));

drop policy if exists "ai_feedback_write_member" on public.ai_feedback;
create policy "ai_feedback_write_member" on public.ai_feedback
  for all
  using (
    exists (select 1 from public.memberships m
            where m.org_id = ai_feedback.org_id and m.user_id = auth.uid()
              and m.role in ('owner','admin','member'))
  )
  with check (
    exists (select 1 from public.memberships m
            where m.org_id = ai_feedback.org_id and m.user_id = auth.uid()
              and m.role in ('owner','admin','member'))
  );

-- ============================================================================
-- End Phase 4 migration.
-- ============================================================================
