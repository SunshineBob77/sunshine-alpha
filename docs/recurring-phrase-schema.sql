-- Recurring Phrase Detection
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Everything else this feature needs (event_at, event_has_time,
-- event_timezone, event_status, temporal_confidence, temporal_raw_text,
-- temporal_locked, recurring, recurrence_type) already exists - see
-- recurring-events-schema.sql. This is the one new column: the raw
-- recurring phrase ("every Monday", "monthly") for general recurring
-- language, stored as free text with no structured parsing.

alter table captures
  add column recurrence_raw_text text;
