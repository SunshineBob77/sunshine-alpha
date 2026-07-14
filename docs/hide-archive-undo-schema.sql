-- Hide / Archive / Undo (Action Row v2)
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.

alter table captures
  add column hidden_until timestamptz,
  add column user_archived_at timestamptz,
  add column previous_state jsonb;

-- hidden_until: Hide Today/Week - null means not hidden. Gates only the
-- literal Lifeline ("all") view; a Drop's own Space view, the Completed
-- view, and the Pinned view are never filtered by this.
--
-- user_archived_at: the new Archive action. Deliberately NOT the existing
-- archived_at column - that one is claimed by system Drops (morning
-- briefs) and is excluded at the fetchCaptures() QUERY level, so
-- anything set there vanishes from the whole app, not just the Lifeline.
-- user_archived_at instead only gates the Lifeline view and the Drop's
-- own Space view - the new Archived system Space filters TO these rows,
-- so they stay fully reachable, never excluded from the fetched dataset.
--
-- previous_state: single-level undo snapshot, captured immediately
-- before each Complete/Hide/Archive transition INTO that state. Null
-- when there's nothing to undo (fresh Drop, or already undone once).
