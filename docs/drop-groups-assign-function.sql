-- Card Carousel v2 follow-up: assign_group_id(capture_id)
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Closes the gap found during live verification: captures' UPDATE policy
-- is strictly owner-only (confirmed throughout this session, no new
-- policy was ever added there for Shared Spaces), so a non-owner member
-- tapping "+" on a Drop they don't own could insert their OWN new card
-- fine, but silently failed (0 rows, no error) to write a fresh group_id
-- onto the OTHER member's still-ungrouped anchor Drop - the two captures
-- never actually ended up sharing a group_id.
--
-- SECURITY DEFINER, not a raw RLS UPDATE policy - pinning all ~30 other
-- columns of captures unchanged via a correlated-subquery WITH CHECK
-- (the approach used for space_members' much narrower self-leave policy)
-- doesn't scale cleanly to a table this wide. A small function whose
-- entire body IS the security boundary is easier to audit at this width.
--
-- Because this runs SECURITY DEFINER (owner privileges, which bypasses
-- RLS internally), it must explicitly re-derive "can auth.uid() see this
-- capture" itself rather than relying on RLS having already filtered the
-- row the way a plain policy-evaluated query would - reuses the existing
-- user_can_view_shared_capture() helper rather than re-deriving that
-- logic a second time.
--
-- Idempotent by design: if the capture already has a group_id (either
-- because it was already a group anchor, or another member's concurrent
-- call already assigned one - guarded by SELECT ... FOR UPDATE), this
-- just returns the existing value instead of erroring or reassigning.
create or replace function public.assign_group_id(target_capture_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  new_group_id uuid;
begin
  select id, user_id, space_ids, group_id into target
  from captures
  where id = target_capture_id
  for update;

  if not found then
    raise exception 'Capture not found';
  end if;

  if target.user_id <> auth.uid()
     and not public.user_can_view_shared_capture(target.space_ids, auth.uid()) then
    raise exception 'Not authorized to view this capture';
  end if;

  if target.group_id is not null then
    return target.group_id;
  end if;

  new_group_id := gen_random_uuid();
  update captures set group_id = new_group_id where id = target_capture_id;

  return new_group_id;
end;
$$;

grant execute on function public.assign_group_id(bigint) to authenticated;
