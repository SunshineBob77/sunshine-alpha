-- Card Carousel v2: group_id links independent Drops into a swipeable
-- carousel. Run in Supabase SQL editor. Saved here for reference/history,
-- not applied automatically.
--
-- Design notes:
-- - Two or more captures sharing the same group_id are members of the
--   same carousel group; group_id null (the default for every existing
--   row) is a normal standalone Drop, completely unaffected.
-- - No new RLS at all - each grouped capture is still just a regular
--   capture row, so it's already fully covered by every existing
--   captures policy (owner-only edit/delete, Shared Spaces view/insert).
--   Group membership only changes how the client chooses to RENDER
--   captures it can already see, not who can see or write them.
-- - Ordering within a group uses each capture's own created_at (already
--   exists on every row) rather than a new order_index column - insertion
--   order is what "the next one fills in" means here, and every capture
--   already has a creation timestamp, so no new column earns its keep.
-- - Partial index (group_id is not null) since the overwhelming majority
--   of rows will have a null group_id and gain nothing from being
--   indexed.
alter table captures
  add column group_id uuid;

create index captures_group_id_idx
  on captures (group_id)
  where group_id is not null;
