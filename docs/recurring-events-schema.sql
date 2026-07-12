-- Recurring Yearly Events (birthdays / anniversaries)
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.

alter table captures
  add column recurring boolean not null default false,
  add column recurrence_type text check (recurrence_type in ('yearly'));
