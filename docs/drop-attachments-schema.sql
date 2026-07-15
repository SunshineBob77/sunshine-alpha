-- SUPERSEDED - see docs/drop-attachments-teardown.sql and
-- docs/drop-groups-schema.sql. Card Carousel's spec changed: attachments
-- turned out to mean full independent Drops linked by a shared group_id
-- on captures itself, not lightweight sub-cards in a separate table. Kept
-- here for reference/history only, per this repo's convention - do not
-- re-apply.
--
-- Card Carousel: lightweight sub-cards attached to a Drop
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - Deliberately NOT a full Drop - no category/project/mood/temporal/AI
--   fields at all, just enough to render a swipeable text sub-card. If
--   photo attachments get built later, this likely needs a nullable
--   image_url column added then, not now.
-- - order_index is computed client-side (current max for that parent + 1)
--   at insert time, not a DB default/trigger - simplest way to preserve
--   insertion order without new server-side logic. Values don't need to
--   be contiguous, only monotonically increasing per parent.
-- - RLS deliberately does NOT introduce a new SECURITY DEFINER helper -
--   unlike spaces<->space_members (which reference each other and need
--   one to break recursion), drop_attachments -> captures is one
--   directional only, so a plain EXISTS subquery against captures
--   naturally inherits whichever policies apply to the CALLING user
--   there (both the original single-owner policy and the Shared Spaces
--   user_can_view_shared_capture one) with zero risk of a cycle. This is
--   the literal "reuse the existing captures RLS logic" the spec asked
--   for, not a re-derivation of it.
-- - Write access intentionally mirrors read access exactly (the "friendly
--   invite" model - no separate/stricter check): whoever can see the
--   parent Drop can attach to it. For a personal (non-shared) Drop, the
--   owner is the ONLY one who can see it at all, so this already reduces
--   to "owner-only" for that case with no extra logic - same reasoning
--   the spec used to justify not special-casing it.
-- - No UPDATE/DELETE policy defined for v1 - editing/deleting an
--   attachment, and the drag-reorder order_index needs, aren't part of
--   this pass. Flagging this as a real, deliberate gap: there is
--   currently no way to remove a wrong/unwanted attachment once added.

create table drop_attachments (
  id bigint generated always as identity primary key,
  parent_capture_id bigint not null references captures(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  content text not null,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index drop_attachments_parent_order_idx
  on drop_attachments (parent_capture_id, order_index);

alter table drop_attachments enable row level security;

create policy "Attachment visibility follows the parent Drop"
  on drop_attachments for select
  using (
    exists (select 1 from captures c where c.id = drop_attachments.parent_capture_id)
  );

create policy "Anyone who can view the parent Drop can attach to it"
  on drop_attachments for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from captures c where c.id = drop_attachments.parent_capture_id)
  );

grant select, insert on public.drop_attachments to authenticated;
grant select, insert, update, delete on public.drop_attachments to service_role;
