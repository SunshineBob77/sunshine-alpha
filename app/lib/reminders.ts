import type { Capture } from "./captures";
import { buildOccurrences, dateKeyInZone } from "./recurringProjection";

export const REMINDERS_WEEK_WINDOW_DAYS = 7;
export const REMINDERS_OUTER_WINDOW_DAYS = 30;

export type ReminderItem = {
  captureId: number;
  title: string;
  dateKey: string;
  checked: boolean;
};

export type ReminderGroups = {
  thisWeek: ReminderItem[];
  comingUp: ReminderItem[];
};

function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Same exclusions as LifelineFeed's own "all" view (completed, archived,
// actively hidden) - a Drop the user has already dismissed from the
// Lifeline shouldn't resurface here. Only dated (resolved) Drops have a
// real occurrence to project, so unresolved/no-date Drops are never
// eligible regardless of status.
function isEligible(capture: Capture): boolean {
  if (capture.eventStatus !== "resolved" || !capture.eventAt) return false;
  if (capture.status === "completed") return false;
  if (capture.userArchivedAt) return false;
  if (capture.hiddenUntil && new Date(capture.hiddenUntil) > new Date()) return false;
  return true;
}

// Builds the Reminders card's two sections straight from the Lifeline's
// already-loaded captures - deliberately not a stored system Drop row the
// way Morning Brief is. This content is cheap to derive (no external API
// call) and needs to react instantly to every checkbox toggle and to the
// calendar day rolling over, neither of which a once-a-day generated row
// handles well. Reuses buildOccurrences() (not calendar/page.tsx's flat
// resolvedCaptures filter) because only buildOccurrences resolves a
// recurring Drop's actual next occurrence date rather than just its
// original anchor event_at.
export function buildReminderGroups(captures: Capture[], todayKey: string): ReminderGroups {
  const throughYear = Number(todayKey.slice(0, 4)) + 1;
  const eligible = captures.filter(isEligible);
  const occurrences = buildOccurrences(eligible, throughYear);

  const weekEndKey = addDaysToKey(todayKey, REMINDERS_WEEK_WINDOW_DAYS - 1);
  const outerEndKey = addDaysToKey(todayKey, REMINDERS_OUTER_WINDOW_DAYS - 1);

  const thisWeek: ReminderItem[] = [];
  const comingUp: ReminderItem[] = [];

  for (const occurrence of occurrences) {
    const dateKey = dateKeyInZone(occurrence.occurrenceDate, occurrence.capture.eventTimezone);
    if (dateKey < todayKey || dateKey > outerEndKey) continue;

    // A dismissal recorded on a prior day means this occurrence was
    // already checked off and acknowledged - it self-prunes from the list
    // for good starting the day after it was checked, regardless of
    // whether its own date has passed yet. A dismissal recorded *today*
    // keeps the item visible but greyed out (checked=true) for the rest
    // of today only.
    const dismissal = occurrence.capture.reminderDismissedDates.find(
      (entry) => entry.occurrenceDate === dateKey
    );
    if (dismissal && dismissal.dismissedOn !== todayKey) continue;

    const item: ReminderItem = {
      captureId: occurrence.capture.id,
      title: occurrence.capture.title ?? occurrence.capture.sunshineSummary,
      dateKey,
      checked: Boolean(dismissal),
    };

    if (dateKey <= weekEndKey) thisWeek.push(item);
    else comingUp.push(item);
  }

  return { thisWeek, comingUp };
}
