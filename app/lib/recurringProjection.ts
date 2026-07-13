import type { Capture } from "./captures";
import { classifyRecurrenceCadence } from "./resolveTemporal";

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Always computes the calendar day in the capture's own recorded
// event_timezone, never the viewer's local zone or raw UTC - a date-only
// event (event_has_time: false) must land on the same day for every
// viewer regardless of where they're looking from. Falls back to UTC only
// if event_timezone is missing or isn't a value Intl recognizes. Moved
// here (was inline in the original AgendaGrid) so both the month view and
// the timeline share one source of truth.
export function getEventDateKey(capture: Capture): string | null {
  if (!capture.eventAt) return null;
  const date = new Date(capture.eventAt);
  const timezone = capture.eventTimezone || "UTC";

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

// Does this capture occur on `dayKey` (YYYY-MM-DD)? True for an exact
// stored event_at match, or - for a recurring capture - a projection
// forward from the first occurrence at its classified cadence (see
// classifyRecurrenceCadence): yearly keeps the original month/day-match-
// in-any-year-at/after-creation behavior (the event only started being
// tracked from creation, it didn't retroactively happen every year
// before that); monthly matches the same day-of-month in any month
// at/after the first occurrence; weekly/biweekly/daily match a day-count
// multiple of 7/14/1 forward from the first occurrence. A cadence
// classifyRecurrenceCadence can't project (null) falls back to the exact-
// match check above only.
export function occursOnDay(capture: Capture, dayKey: string): boolean {
  const eventKey = getEventDateKey(capture);
  if (eventKey === dayKey) return true;
  if (!capture.recurring || !eventKey) return false;

  const cadence = classifyRecurrenceCadence(
    capture.recurring,
    capture.recurrenceType,
    capture.recurrenceRawText
  );
  if (!cadence) return false;

  if (cadence === "yearly") {
    const dayMonthDay = dayKey.slice(5);
    const dayYear = Number(dayKey.slice(0, 4));
    const createdYear = new Date(capture.createdAt).getFullYear();
    return eventKey.slice(5) === dayMonthDay && dayYear >= createdYear;
  }

  if (cadence === "monthly") {
    const [eventYear, eventMonth, eventDay] = eventKey.split("-").map(Number);
    const [dayYear, dayMonth, dayOfMonth] = dayKey.split("-").map(Number);
    if (eventDay !== dayOfMonth) return false;
    const monthDiff = (dayYear - eventYear) * 12 + (dayMonth - eventMonth);
    return monthDiff >= 0;
  }

  const diffDays = daysBetween(eventKey, dayKey);
  if (diffDays < 0) return false;
  if (cadence === "daily") return true;
  if (cadence === "weekly") return diffDays % 7 === 0;
  return diffDays % 14 === 0; // biweekly
}

// Re-projects a recurring capture's stored event_at onto a different
// year, keeping the same month/day (per getEventDateKey, in the
// capture's own event_timezone) and the same time-of-day. Mirrors the
// noon-anchor-for-all-day convention already used when a user manually
// picks a date (buildEventAtIso in DropDetailModal) - just re-applied to
// a new year instead of a freshly chosen date.
export function projectToYear(capture: Capture, year: number): string | null {
  if (!capture.eventAt) return null;
  const eventKey = getEventDateKey(capture);
  if (!eventKey) return null;

  const [, month, day] = eventKey.split("-").map(Number);
  const projected = new Date(capture.eventAt);
  projected.setFullYear(year, month - 1, day);
  return projected.toISOString();
}

// Same convention as projectToYear above (same month/day, per
// getEventDateKey in the capture's own event_timezone, same time-of-day)
// but stepping by whole months instead of whole years. setFullYear(y, m,
// d) with a day that doesn't exist in the target month (e.g. day 31 into
// a 30-day month) rolls over into the NEXT month rather than clamping -
// detected here via the month actually landing where expected, and
// skipped rather than shown on a wrong date.
function projectByMonths(capture: Capture, monthsAhead: number): string | null {
  if (!capture.eventAt) return null;
  const eventKey = getEventDateKey(capture);
  if (!eventKey) return null;

  const [year, month, day] = eventKey.split("-").map(Number);
  const totalMonths = month - 1 + monthsAhead;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const projected = new Date(capture.eventAt);
  projected.setFullYear(targetYear, targetMonth, day);
  if (projected.getMonth() !== targetMonth) return null;

  return projected.toISOString();
}

// Whole-day stepping for weekly/biweekly/daily cadences - unlike months,
// adding N days is never ambiguous (always lands on a real date), so no
// rollover guard is needed here the way projectByMonths needs one.
function projectByDays(capture: Capture, daysAhead: number): string | null {
  if (!capture.eventAt) return null;
  const projected = new Date(capture.eventAt);
  projected.setDate(projected.getDate() + daysAhead);
  return projected.toISOString();
}

export type TimelineOccurrence = {
  capture: Capture;
  occurrenceDate: string; // ISO
  isProjected: boolean;
};

// Generous but bounded per-capture safety cap - daily/weekly cadences
// step far more densely than the old yearly-only projection ever did, so
// unlike the year-bounded yearly loop below, these need their own ceiling
// independent of throughYear to guarantee termination.
const MAX_PROJECTED_OCCURRENCES_PER_CAPTURE = 730;

// Every occurrence (real one-time resolved Drops, plus synthetic
// recurring projections) up through `throughYear`, chronologically
// sorted. Bounded by year so the timeline can extend this incrementally
// as the user scrolls (infinite-scroll-forward) instead of trying to
// generate unbounded output in one call. Regenerates the full list each
// time rather than diffing incrementally - for a personal app's realistic
// data volume this is cheap even across many years.
export function buildOccurrences(captures: Capture[], throughYear: number): TimelineOccurrence[] {
  const occurrences: TimelineOccurrence[] = [];
  const throughMs = new Date(throughYear, 11, 31, 23, 59, 59).getTime();

  for (const capture of captures) {
    if (!capture.eventAt) continue;

    if (!capture.recurring) {
      occurrences.push({ capture, occurrenceDate: capture.eventAt, isProjected: false });
      continue;
    }

    const cadence = classifyRecurrenceCadence(
      capture.recurring,
      capture.recurrenceType,
      capture.recurrenceRawText
    );

    if (!cadence) {
      // Recurring, but at a cadence classifyRecurrenceCadence deliberately
      // doesn't project (e.g. "every weekday"/"every weekend" - see its own
      // doc comment) - still show the single resolved occurrence, same as
      // a non-recurring Drop, rather than silently dropping it.
      occurrences.push({ capture, occurrenceDate: capture.eventAt, isProjected: false });
      continue;
    }

    if (cadence === "yearly") {
      const createdYear = new Date(capture.createdAt).getFullYear();
      const firstYear = new Date(capture.eventAt).getFullYear();
      const startYear = Math.max(createdYear, firstYear);

      for (let year = startYear; year <= throughYear; year++) {
        const iso = year === firstYear ? capture.eventAt : projectToYear(capture, year);
        if (!iso) continue;
        occurrences.push({ capture, occurrenceDate: iso, isProjected: year !== firstYear });
      }
      continue;
    }

    if (cadence === "monthly") {
      for (let i = 0; i < MAX_PROJECTED_OCCURRENCES_PER_CAPTURE; i++) {
        const iso = i === 0 ? capture.eventAt : projectByMonths(capture, i);
        if (iso === null) continue;
        if (new Date(iso).getTime() > throughMs) break;
        occurrences.push({ capture, occurrenceDate: iso, isProjected: i !== 0 });
      }
      continue;
    }

    const stepDays = cadence === "daily" ? 1 : cadence === "weekly" ? 7 : 14;
    for (let i = 0; i < MAX_PROJECTED_OCCURRENCES_PER_CAPTURE; i++) {
      const iso = i === 0 ? capture.eventAt : projectByDays(capture, i * stepDays);
      if (iso === null) continue;
      if (new Date(iso).getTime() > throughMs) break;
      occurrences.push({ capture, occurrenceDate: iso, isProjected: i !== 0 });
    }
  }

  return occurrences.sort(
    (a, b) => new Date(a.occurrenceDate).getTime() - new Date(b.occurrenceDate).getTime()
  );
}
