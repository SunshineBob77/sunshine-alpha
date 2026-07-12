-- Shared Spaces v1 schema
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - Personal Spaces (defaultSpaces in spaces.ts) are untouched - only
--   shared Spaces get real DB rows. "Convert to shared" = create a new
--   twin row here, never mutate the personal space or its existing Drops.
-- - captures.space_ids (existing text[]) needs NO schema change - a
--   shared space's uuid (cast to text) just sits alongside "personal" in
--   the same array, which is what makes "still appears in owner's
--   personal Lifeline too" free.
-- - The new captures SELECT policy below is ADDITIVE - Postgres OR's
--   multiple permissive policies for the same command together
--   automatically, so the existing strict single-owner policy (verified
--   empirically, exact text not available from this environment) is
--   never touched or replaced, only extended.
-- - UPDATE/DELETE on captures are deliberately left completely alone -
--   "cannot reshare/edit another member's Drop" is already fully true
--   today (verified empirically) and needs no new policy.
-- - spaces and space_members cross-reference each other for their SELECT
--   policies. A naive direct subquery from one into the other's RLS-
--   respecting SELECT causes "infinite recursion detected in policy"
--   (42P17) - table A's policy queries table B, which triggers table B's
--   policy, which queries table A again, forever. Fixed via SECURITY
--   DEFINER helper functions (is_space_member/is_space_owner/
--   user_can_view_shared_capture) that bypass RLS internally when
--   crossing between the two tables, breaking the cycle - the standard
--   Postgres/Supabase pattern for this exact problem.

-- ---------------------------------------------------------------------
-- profiles - needed for author attribution in shared views (auth.users
-- is never exposed to PostgREST directly).
-- ---------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Any authenticated user can read profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Auto-populate on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users (e.g. Bob's own account, predates this trigger).
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- spaces - shared Spaces only. Personal Spaces stay hardcoded in
-- app/lib/spaces.ts, untouched.
-- ---------------------------------------------------------------------

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '👥',
  color text not null default 'bg-pink-100',
  border text not null default 'border-pink-400',
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table spaces enable row level security;

-- "Members can view their spaces" (the owner-or-member SELECT policy) is
-- added further down, after space_members exists - CREATE POLICY
-- validates its USING clause against existing schema immediately (unlike
-- a function body, which is only checked at call time), so a policy
-- referencing space_members here, before that table exists, fails outright.

create policy "Users can create a shared space they own"
  on spaces for insert
  with check (owner_user_id = auth.uid());

create policy "Owner can update their space"
  on spaces for update
  using (owner_user_id = auth.uid());

create policy "Owner can delete their space"
  on spaces for delete
  using (owner_user_id = auth.uid());

grant select, insert, update, delete on public.spaces to authenticated;
grant select, insert, update, delete on public.spaces to service_role;

-- ---------------------------------------------------------------------
-- space_members - owner + member roles only for v1. Soft removal only
-- (removed_at, never a hard delete) - past contributions stay visible to
-- other members by design; no DELETE policy is defined at all, so RLS
-- default-denies hard deletes entirely.
-- ---------------------------------------------------------------------

create table space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint space_members_user_or_email check (user_id is not null or invited_email is not null)
);

-- Allows re-adding a user after a soft removal (the partial index only
-- covers currently-active rows), while still preventing two active
-- memberships for the same user in the same space.
create unique index space_members_unique_active_user
  on space_members (space_id, user_id)
  where removed_at is null and user_id is not null;

alter table space_members enable row level security;

-- SECURITY DEFINER: runs with the function owner's privileges, which
-- bypasses RLS on the table being queried internally (Supabase's SQL
-- editor role owns both tables and has BYPASSRLS) - this is what breaks
-- the spaces <-> space_members recursion, not just a style choice.
create or replace function public.is_space_member(check_space_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = check_space_id
      and user_id = check_user_id
      and removed_at is null
  );
$$;

create or replace function public.is_space_owner(check_space_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from spaces
    where id = check_space_id
      and owner_user_id = check_user_id
  );
$$;

-- Owner is already an active member (auto-added by the on_space_created
-- trigger below, role='owner'), so is_space_member() alone covers both
-- owner and regular member visibility - no separate owner-check needed.
create policy "Members can view fellow members of their spaces"
  on space_members for select
  using (public.is_space_member(space_id, auth.uid()));

create policy "Owner can add members"
  on space_members for insert
  with check (public.is_space_owner(space_id, auth.uid()));

create policy "Owner can update members (soft-remove)"
  on space_members for update
  using (public.is_space_owner(space_id, auth.uid()));

grant select, insert, update on public.space_members to authenticated;
grant select, insert, update, delete on public.space_members to service_role;

-- Auto-add the creator as 'owner' in space_members, so every downstream
-- membership check (including the new captures SELECT policy below) has
-- exactly one source of truth instead of needing to special-case
-- spaces.owner_user_id separately everywhere.
create or replace function public.handle_new_space()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.space_members (space_id, user_id, role, joined_at)
  values (new.id, new.owner_user_id, 'owner', now());
  return new;
end;
$$;

create trigger on_space_created
  after insert on spaces
  for each row execute function public.handle_new_space();

-- Deferred from the spaces block above - space_members (and
-- is_space_member) now exist, so this owner-or-member SELECT policy can
-- finally reference them. Uses the SECURITY DEFINER function, not a
-- direct subquery, to avoid the spaces <-> space_members recursion.
create policy "Members can view their spaces"
  on spaces for select
  using (
    owner_user_id = auth.uid()
    or public.is_space_member(id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- captures - one additive SELECT policy. Existing policies (owner-only,
-- across all operations) are untouched.
-- ---------------------------------------------------------------------

-- space_members.space_id is uuid; captures.space_ids is text[] (already
-- holds plain strings like "personal", "work"). Cast the single
-- membership id to text rather than casting the whole array to uuid[] -
-- casting the array would error on every row whose space_ids contains a
-- non-uuid personal space string. Goes through a SECURITY DEFINER
-- function (not a direct subquery) for the same recursion-avoidance
-- reason as the spaces/space_members policies above.
create or replace function public.user_can_view_shared_capture(check_space_ids text[], check_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where user_id = check_user_id
      and removed_at is null
      and space_id::text = any(check_space_ids)
  );
$$;

create policy "Space members can view Drops shared into their spaces"
  on captures for select
  using (public.user_can_view_shared_capture(space_ids, auth.uid()));
