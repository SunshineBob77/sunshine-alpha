-- Pinned Space
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.

alter table captures
  add column pinned boolean not null default false;
