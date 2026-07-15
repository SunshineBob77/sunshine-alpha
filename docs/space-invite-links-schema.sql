-- Shared Spaces: invite links (shareable link/code, not raw email invite)
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - token is DB-generated (encode(gen_random_bytes(24), 'hex') - pgcrypto
--   is already in use here, since gen_random_uuid() already appears
--   elsewhere in this schema), never client-supplied - keeps the actual
--   secret-generation on the trusted side, same reasoning as every other
--   DB-default id/token in this codebase.
-- - Default expiry: 30 days (confirmed). Column stays nullable so a
--   specific link can still be set to never-expire later if wanted -
--   this is a per-row default, not a hard constraint.
-- - Default reusability: unlimited (max_uses null). use_count tracks
--   actual redemptions so a single-use link is just a config choice
--   (max_uses = 1) later, not a redesign.
-- - revoked_at (nullable, owner-settable) mirrors space_members' own
--   soft-delete philosophy - no hard DELETE policy defined here either,
--   consistent with that table.
-- - No general SELECT policy - knowing the token is what authorizes you,
--   not being logged in, so a blanket "authenticated can read" policy
--   would let anyone enumerate every outstanding token for every space.
--   Only the owner gets direct table SELECT (for a future manage/revoke
--   UI); preview and redemption both go through SECURITY DEFINER
--   functions that take the exact token as an argument instead.

create table invite_links (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz default (now() + interval '30 days'),
  max_uses integer,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table invite_links enable row level security;

create policy "Owner can view their space's invite links"
  on invite_links for select
  using (public.is_space_owner(space_id, auth.uid()));

create policy "Owner can create invite links"
  on invite_links for insert
  with check (public.is_space_owner(space_id, auth.uid()) and created_by = auth.uid());

-- Covers early revocation (setting revoked_at) - the same owner-broad
-- shape as "Owner can update members (soft-remove)" on space_members, no
-- WITH CHECK narrowing needed since only the owner can reach this at all.
create policy "Owner can revoke their invite links"
  on invite_links for update
  using (public.is_space_owner(space_id, auth.uid()));

grant select, insert, update on public.invite_links to authenticated;
grant select, insert, update, delete on public.invite_links to service_role;

-- ---------------------------------------------------------------------
-- preview_invite - read-only, by exact token only. Grants to anon too:
-- "receive a link, then sign up" means the preview (space name/icon,
-- still-valid check) needs to work before an account exists. Exposes
-- nothing beyond that - no member list, no captures, no space id even
-- unless valid.
-- ---------------------------------------------------------------------
create or replace function public.preview_invite(check_token text)
returns table(space_name text, space_icon text, is_valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.name,
    s.icon,
    (
      il.revoked_at is null
      and (il.expires_at is null or il.expires_at > now())
      and (il.max_uses is null or il.use_count < il.max_uses)
    ) as is_valid
  from invite_links il
  join spaces s on s.id = il.space_id
  where il.token = check_token;
$$;

grant execute on function public.preview_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- redeem_invite - authenticated only. Does validity checks + the
-- space_members insert + the use_count increment in one transaction,
-- with a row lock (SELECT ... FOR UPDATE) on the invite itself first -
-- "atomically check-and-increment a shared counter" isn't something an
-- RLS WITH CHECK can express safely, so this has to be a function, not a
-- client-side INSERT gated by policy. Always inserts role='member' -
-- never owner, regardless of what's passed in (nothing is passed in;
-- there's no role parameter at all). Re-joining after a prior
-- soft-removal upserts against the existing partial unique index
-- (space_members_unique_active_user), same as the owner's own add-member
-- path already assumes.
-- ---------------------------------------------------------------------
-- NOTE: the OUT parameters are named out_space_id/out_role, not
-- space_id/role - RETURNS TABLE(...) implicitly declares its columns as
-- PL/pgSQL variables visible through the whole function body, and
-- `on conflict (space_id, user_id)` below can't be table-qualified
-- (ON CONFLICT target lists are always bare column names), so a
-- same-named OUT parameter makes that reference genuinely ambiguous to
-- Postgres ("column reference \"space_id\" is ambiguous", 42702) -
-- caught live during verification, not theoretical. Prefixing avoids the
-- collision entirely.
create or replace function public.redeem_invite(check_token text)
returns table(out_space_id uuid, out_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  select * into invite from invite_links where token = check_token for update;

  if not found then
    raise exception 'Invalid invite link';
  end if;
  if invite.revoked_at is not null then
    raise exception 'This invite link has been revoked';
  end if;
  if invite.expires_at is not null and invite.expires_at <= now() then
    raise exception 'This invite link has expired';
  end if;
  if invite.max_uses is not null and invite.use_count >= invite.max_uses then
    raise exception 'This invite link has already been used';
  end if;

  -- The ON CONFLICT predicate must match space_members_unique_active_user
  -- (shared-spaces-schema.sql) EXACTLY, including `user_id is not null` -
  -- Postgres needs a textual match to infer which partial unique index
  -- this targets, not just a logically-compatible one. Missing that
  -- clause here caused "no unique or exclusion constraint matching the
  -- ON CONFLICT specification" (42P10) live during verification.
  insert into space_members (space_id, user_id, role, joined_at)
  values (invite.space_id, auth.uid(), 'member', now())
  on conflict (space_id, user_id) where removed_at is null and user_id is not null
    do nothing;

  update invite_links set use_count = use_count + 1 where id = invite.id;

  out_space_id := invite.space_id;
  out_role := 'member';
  return next;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
