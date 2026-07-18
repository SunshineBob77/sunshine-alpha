-- Invite acceptance route: RPC fixes/extensions
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Two changes to the invite RPCs from docs/space-invite-links-schema.sql,
-- both required to build the actual acceptance route
-- (app/join/[token]/page.tsx) - flagging both explicitly since the brief
-- said "don't modify the RPCs' core logic except the use_count fix":
-- validity checks, the membership insert semantics, and role always
-- being 'member' are all untouched. What's added is strictly additional
-- return-value detail the route needs and has no other way to get.
--
-- 1. redeem_invite(): fixes the known use_count bug (incrementing even
--    when the insert was a no-op via ON CONFLICT DO NOTHING) AND, using
--    the exact same INSERT...RETURNING check, adds a new
--    out_already_member boolean so the caller can tell "just joined"
--    apart from "was already a member" without a second query. Needed
--    for the join route's friendly "you're already in this space" case -
--    preview_invite deliberately never exposes space_id (see its own
--    original design note), so there's no way to check membership before
--    attempting redemption; reusing redeem_invite's own idempotent no-op
--    is the only place this signal can come from.
--
-- 2. preview_invite(): the single is_valid boolean becomes a status enum
--    ('valid' | 'revoked' | 'expired' | 'exhausted') so the join route
--    can show a specific, accurate reason BEFORE prompting an
--    unauthenticated visitor through a full signup - the boolean alone
--    can't distinguish "revoked" from "expired" from "exhausted," and the
--    brief requires each to read differently. The "not found" case
--    (token matches no row at all) still isn't a value of status - it's
--    zero rows returned, exactly as before; the existing client wrapper
--    (previewInvite in app/lib/sharedSpaces.ts) already throws "Invite
--    link not found." for that case and didn't need to change.
--
-- Both are CREATE OR REPLACE with an unchanged parameter list (still
-- exactly `(text)` on each), so existing grants are preserved regardless -
-- the GRANT statements below are repeated anyway for clarity, matching
-- this repo's existing convention of always showing the grant next to the
-- function it belongs to.

create or replace function public.preview_invite(check_token text)
returns table(space_name text, space_icon text, status text)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.name,
    s.icon,
    case
      when il.revoked_at is not null then 'revoked'
      when il.expires_at is not null and il.expires_at <= now() then 'expired'
      when il.max_uses is not null and il.use_count >= il.max_uses then 'exhausted'
      else 'valid'
    end as status
  from invite_links il
  join spaces s on s.id = il.space_id
  where il.token = check_token;
$$;

grant execute on function public.preview_invite(text) to anon, authenticated;

create or replace function public.redeem_invite(check_token text)
returns table(out_space_id uuid, out_role text, out_already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  inserted_id uuid;
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

  -- Same ON CONFLICT target as before (must textually match
  -- space_members_unique_active_user - see the original schema doc's own
  -- note on this). RETURNING id lets PL/pgSQL tell a real insert apart
  -- from a conflict-driven no-op: `inserted_id` comes back null when the
  -- caller was already an active member, non-null otherwise - standard
  -- documented behavior for "INSERT ... RETURNING ... INTO var" when zero
  -- rows are returned.
  insert into space_members (space_id, user_id, role, joined_at)
  values (invite.space_id, auth.uid(), 'member', now())
  on conflict (space_id, user_id) where removed_at is null and user_id is not null
    do nothing
  returning id into inserted_id;

  -- THE FIX: only a genuine new membership counts as a redemption now.
  -- Previously this UPDATE ran unconditionally after the insert above,
  -- so an already-member re-redeeming the same token silently inflated
  -- use_count with zero membership effect.
  if inserted_id is not null then
    update invite_links set use_count = use_count + 1 where id = invite.id;
  end if;

  out_space_id := invite.space_id;
  out_role := 'member';
  out_already_member := inserted_id is null;
  return next;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
