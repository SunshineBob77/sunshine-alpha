-- Checklist Drops
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.

alter table captures
  add column checklist_items jsonb not null default '[]'::jsonb;
