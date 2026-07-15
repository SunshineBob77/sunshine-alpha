-- Space members: self-service leave (soft-remove your own membership)
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Closes the gap found in the Shared Spaces audit: the only existing
-- UPDATE policy on space_members ("Owner can update members (soft-remove)")
-- is is_space_owner-gated, so a non-owner member had no way to leave a
-- space themselves - confirmed empirically (Mary's leaveSpace() call was
-- rejected with 0 rows affected, before this policy existed).
--
-- Scoped deliberately narrow, per instruction:
-- - USING restricts this to the caller's OWN, currently-active row only -
--   they can never target another member's row (that still requires
--   is_space_owner, via the existing separate policy).
-- - WITH CHECK allows exactly one transition: removed_at going from null
--   to non-null. Every other column (role, space_id, user_id,
--   invited_email, joined_at) is pinned to its existing value via a
--   correlated self-lookup by primary key - the standard Postgres RLS
--   pattern for "let this column change, but not that one" without a
--   trigger. No new SECURITY DEFINER helper needed here (unlike the
--   cross-table spaces<->space_members policies) since this only ever
--   reads/writes space_members itself - no recursion risk.
-- - Deliberately one-way (null -> non-null only), not symmetric with the
--   owner's policy (which has no WITH CHECK and can freely reinstate
--   someone). Without pinning this direction, a member kicked by the
--   owner could immediately un-remove themselves through this same
--   policy - self-leave must not double as self-un-kick.
create policy "Members can remove themselves"
  on space_members for update
  using (user_id = auth.uid() and removed_at is null)
  with check (
    user_id = auth.uid()
    and removed_at is not null
    and role = (select sm.role from space_members sm where sm.id = space_members.id)
    and space_id = (select sm.space_id from space_members sm where sm.id = space_members.id)
    and joined_at = (select sm.joined_at from space_members sm where sm.id = space_members.id)
    and coalesce(invited_email, '') = coalesce(
      (select sm.invited_email from space_members sm where sm.id = space_members.id), ''
    )
  );
