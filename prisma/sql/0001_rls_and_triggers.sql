-- ============================================================================
-- Sightline — Phase 0 security migration
-- Row-Level Security + auth→profile trigger.
--
-- Apply this AFTER `prisma migrate` has created the tables
-- (profiles, organizations, memberships). Run it in the Supabase SQL editor
-- or via `psql $DIRECT_URL -f prisma/sql/0001_rls_and_triggers.sql`.
--
-- This is the database-level half of multi-tenancy. The application-level half
-- lives in src/lib/org-scope.ts. Defense in depth: both must hold.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: which orgs does the current (JWT) user belong to?
--    SECURITY DEFINER so the function can read memberships without recursing
--    through the very RLS policy it powers.
-- ----------------------------------------------------------------------------
create or replace function public.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = auth.uid();
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.org_id = target_org
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on every Phase 0 table.
-- ----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.organizations  enable row level security;
alter table public.memberships    enable row level security;

-- ----------------------------------------------------------------------------
-- 3. profiles — a user may read/update only their own profile row.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. organizations — visible only to members; only owners/admins may update.
-- ----------------------------------------------------------------------------
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (public.is_org_member(id));

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin"
  on public.organizations for update
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 5. memberships — a user sees memberships of orgs they belong to.
--    This is the heart of tenant isolation: org A can never see org B.
-- ----------------------------------------------------------------------------
drop policy if exists "memberships_select_same_org" on public.memberships;
create policy "memberships_select_same_org"
  on public.memberships for select
  using (org_id in (select public.current_user_org_ids()));

drop policy if exists "memberships_modify_admin" on public.memberships;
create policy "memberships_modify_admin"
  on public.memberships for all
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = memberships.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.org_id = memberships.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Trigger: create a profile row automatically on auth signup.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- End Phase 0 security migration.
-- ============================================================================
