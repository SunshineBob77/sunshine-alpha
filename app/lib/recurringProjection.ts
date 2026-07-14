import type { Capture } from "./captures";
import { classifyRecurrenceCadence } from "./resolveTemporal";

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Always computes the calendar day in the given timezone, never the
// viewer's local zone or raw UTC - a date-only event (event_has_time:
// false) must land on the same day for every viewer regardless of where
// they're looking from. Falls back to UTC only if the timezone is missing
// or isn't a value Intl recognizes. Takes a raw ISO string rather than a
// Capture so it also works on a projected/synthetic occurrence date (see
// buildOccurrences below), not just a capture's own stored event_at.
export function dateKeyInZone(iso: string, timezone: string | null): string {
  const date = new Date(iso);
  const zone = timezone || "UTC";

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
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

// Moved here (was inline in the original AgendaGrid) so both the month
// view and the timeline share one source of truth.
export function getEventDateKey(capture: Capture): string | null {
  if (!capture.eventAt) return null;
  return dateKeyInZone(capture.eventAt, capture.eventTimezone);
}

// Does this capture occur on `dayKey` (YYYY-MM-DD)? True for an exact
// stored event_at match, or - for a recurring capture - a projection
// forward from the first occurrence at its classified step (see
// classifyRecurrenceCadence): year-unit keeps the original month/day-
// match-in-any-year-at/after-creation behavior for interval<=1 (the
// event only started being tracked from creation, it didn't
// retroactively happen every year before that) - byte-equivalent to the
// old fixed "yearly" cadence - and adds a modulo-interval check only for
// interval>1 (numeric "every N years"). month-unit matches the same day-
// of-month at a monthDiff that's both >=0 and a multiple of interval
// (interval defaults to 1, so this is equivalent to the old "monthly"
// cadence when unset). week/day-unit match a day-count multiple of
// interval*(7 for week, 1 for day) forward from the first occurrence -
// this single formula covers what used to be three separate cadences
// (weekly/biweekly/daily). A step classifyRecurrenceCadence can't
// produce (null) falls back to the exact-match check above only.
export function occursOnDay(capture: Capture, dayKey: string): boolean {
  const eventKey = getEventDateKey(capture);
  if (eventKey === dayKey) return true;
  if (!capture.recurring || !eventKey) return false;

  const step = classifyRecurrenceCadence(
    capture.recurring,
    capture.recurrenceType,
    capture.recurrenceRawText,
    capture.recurrenceInterval
  );
  if (!step) return false;

  if (step.unit === "year") {
    const dayMonthDay = dayKey.slice(5);
    const dayYear = Number(dayKey.slice(0, 4));
    const createdYear = new Date(capture.createdAt).getFullYear();
    if (eventKey.slice(5) !== dayMonthDay || dayYear < createdYear) return false;
    if (step.interval <= 1) return true;
    const eventYear = Number(eventKey.slice(0, 4));
    return (dayYear - eventYear) % step.interval === 0;
  }

  if (step.unit === "month") {
    const [eventYear, eventMonth, eventDay] = eventKey.split("-").map(Number);
    const [dayYear, dayMonth, dayOfMonth] = dayKey.split("-").map(Number);
    if (eventDay !== dayOfMonth) return false;
    const monthDiff = (dayYear - eventYear) * 12 + (dayMonth - eventMonth);
    return monthDiff >= 0 && monthDiff % step.interval === 0;
  }

  const diffDays = daysBetween(eventKey, dayKey);
  if (diffDays < 0) return false;
  const stepDays = step.unit === "week" ? 7 * step.interval : step.interval;
  return diffDays % stepDays === 0;
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

    const step = classifyRecurrenceCadence(
      capture.recurring,
      capture.recurrenceType,
      capture.recurrenceRawText,
      capture.recurrenceInterval
    );

    if (!step) {
      // Recurring, but at a step classifyRecurrenceCadence deliberately
      // doesn't project (e.g. "every weekday"/"every weekend" - see its own
      // doc comment) - still show the single resolved occurrence, same as
      // a non-recurring Drop, rather than silently dropping it.
      occurrences.push({ capture, occurrenceDate: capture.eventAt, isProjected: false });
      continue;
    }

    if (step.unit === "year") {
      const createdYear = new Date(capture.createdAt).getFullYear();
      const firstYear = new Date(capture.eventAt).getFullYear();
      const startYear = Math.max(createdYear, firstYear);

      // interval defaults to 1, in which case (year - firstYear) % 1 is
      // always 0 - byte-equivalent to the old unconditional yearly loop.
      for (let year = startYear; year <= throughYear; year++) {
        if ((year - firstYear) % step.interval !== 0) continue;
        const iso = year === firstYear ? capture.eventAt : projectToYear(capture, year);
        if (!iso) continue;
        occurrences.push({ capture, occurrenceDate: iso, isProjected: year !== firstYear });
      }
      continue;
    }

    if (step.unit === "month") {
      for (let i = 0; i < MAX_PROJECTED_OCCURRENCES_PER_CAPTURE; i += step.interval) {
        const iso = i === 0 ? capture.eventAt : projectByMonths(capture, i);
        if (iso === null) continue;
        if (new Date(iso).getTime() > throughMs) break;
        occurrences.push({ capture, occurrenceDate: iso, isProjected: i !== 0 });
      }
      continue;
    }

    const stepDays = step.unit === "week" ? 7 * step.interval : step.interval;
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
