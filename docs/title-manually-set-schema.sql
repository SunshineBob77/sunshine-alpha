-- Manually-set title lock
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Mirrors space_manually_set (see pinned-space-schema.sql and
-- updateCaptureSpaces in captures.ts): once a user manually edits a Drop's
-- title via DropDetailModal's Save handler, analyze-drop/route.ts must never
-- silently regenerate and overwrite it on a later re-analysis pass (e.g. the
-- fire-and-forget analyzeDrop() call that fires after every text/title
-- save, whether or not the note's text itself actually changed).
-- Existing rows default to false, so every already-created Drop keeps
-- getting its title freely updated by AI exactly as before, unless/until a
-- user manually edits its title going forward.

alter table captures
  add column title_manually_set boolean not null default false;
