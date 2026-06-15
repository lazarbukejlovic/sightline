-- ============================================================================
-- Sightline — Phase 5 migration (audit log: RLS)
--
-- Apply AFTER `npx prisma db push` has created the `audit_log` table. Run in
-- the Supabase SQL editor or: psql "$DIRECT_URL" -f prisma/sql/0006_phase5.sql
--
-- Audit entries are written server-side (Prisma, RLS-bypassing). The UI reads
-- them, owner/admin-only, enforced in app code; this policy is defense-in-depth.
-- Idempotent. Reuses helpers from 0001_rls_and_triggers.sql.
-- ============================================================================

alter table public.audit_log enable row level security;

-- Only owners/admins of the org may read the audit log via the anon/auth key.
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select using (
    exists (select 1 from public.memberships m
            where m.org_id = audit_log.org_id and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  );

-- ============================================================================
-- End Phase 5 migration.
-- ============================================================================
