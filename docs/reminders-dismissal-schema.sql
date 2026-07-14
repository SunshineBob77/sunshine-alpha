-- Reminders system Drop: per-occurrence dismissal tracking.
--
-- The Reminders card itself is NOT a stored capture row (unlike Morning
-- Brief) - it's computed live on the client from captures already loaded,
-- via buildReminderGroups() (app/lib/reminders.ts). The only new
-- persistence it needs is where a check-off happened, since a recurring
-- Drop's occurrences must be dismissible independently of each other
-- (checking off today's trash day must not silence next week's).
--
-- Each entry is { occurrenceDate: "YYYY-MM-DD", dismissedOn: "YYYY-MM-DD" }:
--   occurrenceDate - which calendar-day occurrence this dismissal targets
--   dismissedOn    - the calendar day the checkbox was actually tapped
--
-- dismissedOn is what lets an item stay visible (greyed out) for the rest
-- of the day it was checked, then disappear entirely from then on - see
-- buildReminderGroups' filtering logic, not a database constraint.
alter table captures
  add column reminder_dismissed_dates jsonb not null default '[]'::jsonb;
