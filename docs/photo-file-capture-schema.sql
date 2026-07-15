-- Photo / Gallery / File capture v1
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - One private storage bucket ("drop-attachments") holds both photo and
--   generic file attachments - there's no behavioral difference in how
--   they're stored, only in how they're later rendered (image vs a plain
--   filename chip) and whether analyze-drop runs vision on them. Object
--   path convention: "{capture_id}/{random-uuid}.{ext}" - the leading
--   folder segment is what the RLS policies below key off of via
--   storage.foldername(name).
-- - captures gets three new nullable columns: image_path (Photo/Gallery),
--   file_path + file_name (File). A Drop can have at most one attachment
--   in v1 (whichever of these got set at capture time) - multiple
--   attachments per Drop isn't in scope here (Card Carousel's grouped-
--   Drops mechanism is the existing way to attach more than one thing).
-- - RLS mirrors the same trick already used by drop_attachments (see
--   docs/drop-attachments-schema.sql, superseded but the reasoning still
--   applies): a plain `exists (select 1 from captures where id = ...)`
--   subquery, run as the calling user, is already filtered by captures'
--   own SELECT RLS (owner-only, or the Shared Spaces additive policy) -
--   so storage visibility automatically matches "can this user see the
--   parent Drop" with zero duplicated logic and zero risk of drifting
--   out of sync with captures' own rules as they evolve.
-- - INSERT is deliberately narrower than SELECT: only the capture's own
--   owner can attach a file to it (matches captures' UPDATE policy being
--   owner-only - the upload is always immediately followed by an UPDATE
--   to captures.image_path/file_path, so allowing a non-owner to upload
--   into the folder but then fail the follow-up UPDATE would just be a
--   confusing half-failure instead of a clean permission boundary).
-- - No UPDATE/DELETE storage policy for v1 - same deliberate gap
--   drop_attachments documented: deleting a Drop (or replacing its
--   attachment) leaves the storage object orphaned. Flagging this
--   explicitly rather than silently handling it - cleanup is follow-up
--   work, not part of this pass.
-- - Bucket is PRIVATE (public = false). Display always goes through a
--   short-lived signed URL requested client-side (supabase-js
--   createSignedUrl), never a public URL - this is what makes "photo
--   visibility follows the same rules as the Drop it's attached to" true
--   even for Shared Spaces, not just personal Drops.

insert into storage.buckets (id, name, public)
values ('drop-attachments', 'drop-attachments', false)
on conflict (id) do nothing;

alter table captures
  add column image_path text,
  add column file_path text,
  add column file_name text;

create policy "Attachment visibility follows the parent Drop"
  on storage.objects for select
  using (
    bucket_id = 'drop-attachments'
    and exists (
      select 1 from captures c
      where c.id = (storage.foldername(name))[1]::bigint
    )
  );

create policy "Only the Drop's owner can attach a file to it"
  on storage.objects for insert
  with check (
    bucket_id = 'drop-attachments'
    and exists (
      select 1 from captures c
      where c.id = (storage.foldername(name))[1]::bigint
        and c.user_id = auth.uid()
    )
  );

-- service_role (used by app/lib/supabaseAdmin.ts, e.g. analyze-drop's
-- vision download) bypasses RLS entirely by default - no separate grant
-- needed here, same as every other table in this app.
