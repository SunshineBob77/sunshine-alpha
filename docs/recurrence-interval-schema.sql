-- Numeric-Interval Recurrence ("every N days/weeks/months/years")
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- recurrence_type's existing check constraint only ever allowed 'yearly'
-- (the structured birthday/anniversary path - see
-- recurring-events-schema.sql). This widens it to also allow the bare
-- unit words the new numeric-interval detection path uses
-- ('day'/'week'/'month'/'year') - deliberately singular and distinct
-- from 'yearly', which stays reserved for the birthday path exactly as
-- before (still means "this specific structured yearly-life-event
-- recurrence", not "unit: year").
--
-- Existing non-numeric general recurrence phrases ("every Monday",
-- "monthly", "daily", detected by RECURRENCE_PHRASE_PATTERN in
-- resolveTemporal.ts) are UNCHANGED by this - they still leave
-- recurrence_type null and describe themselves via recurrence_raw_text
-- alone. Only the NEW numeric-interval detection path (detectNumericRecurrence)
-- writes a recurrence_type value, always paired with recurrence_interval.
--
-- If your constraint has a different auto-generated name than the one
-- below (check via the Supabase table editor's constraints view, or
-- `\d captures` in the SQL editor), drop that name instead - this is the
-- Postgres default name for a column-level check constraint added via
-- `add column recurrence_type text check (...)`.

alter table captures
  drop constraint captures_recurrence_type_check;

alter table captures
  add constraint captures_recurrence_type_check
    check (recurrence_type in ('yearly', 'day', 'week', 'month', 'year')),
  add column recurrence_interval integer;
