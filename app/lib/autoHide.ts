import type { Capture } from "./captures";
import { buildOccurrences } from "./recurringProjection";

export const AUTO_HIDE_WINDOW_DAYS = 7;

// Next occurrence on or after `now` - for a recurring dated Drop this is
// NOT necessarily the stored event_at (that's just the first/anchor
// occurrence), it's whichever future date buildOccurrences projects next.
// Reused from the same recurrence-projection engine Reminders relies on,
// rather than a second implementation of "what's the next date."
function nextOccurrenceOnOrAfter(capture: Capture, now: Date): string | null {
  const throughYear = now.getFullYear() + 1;
  const occurrences = buildOccurrences([capture], throughYear);
  const upcoming = occurrences.find(
    (occurrence) => new Date(occurrence.occurrenceDate).getTime() >= now.getTime()
  );
  return upcoming?.occurrenceDate ?? null;
}

// Pure, read-time computation - no stored auto-hide state, no cron job
// (per spec, "client-side computed at read-time is fine for v1"). Only
// ever applies to dated (resolved) Drops; undated Drops are always
// exempt - manual Hide is the only thing that affects them.
//
// Non-recurring: hidden while its date is more than AUTO_HIDE_WINDOW_DAYS
// away; once the date has passed, this mechanism has nothing left to say
// about it (Completed is the normal way to close it out from there).
//
// Recurring (birthdays, anniversaries): uses the NEXT upcoming occurrence,
// not the stored anchor date - so a birthday re-hides itself the day
// after it happens, and re-activates on its own next year, without
// touching Completed at all (recurring dated Drops don't use Completed -
// a UI-level rule this function doesn't need to know about, it just
// answers "hidden or not" for whatever occurrence is next).
export function isAutoHidden(capture: Capture, now: Date = new Date()): boolean {
  if (capture.eventStatus !== "resolved" || !capture.eventAt) return false;

  if (!capture.recurring) {
    const daysUntil = (new Date(capture.eventAt).getTime() - now.getTime()) / 86400000;
    if (daysUntil < 0) return false;
    return daysUntil > AUTO_HIDE_WINDOW_DAYS;
  }

  const nextOccurrenceIso = nextOccurrenceOnOrAfter(capture, now);
  if (!nextOccurrenceIso) return false;

  const daysUntil = (new Date(nextOccurrenceIso).getTime() - now.getTime()) / 86400000;
  return daysUntil > AUTO_HIDE_WINDOW_DAYS;
}
