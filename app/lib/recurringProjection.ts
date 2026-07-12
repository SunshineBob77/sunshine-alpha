import type { Capture } from "./captures";

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
// stored event_at match, or - for recurring captures - a month/day match
// in any year at/after the Drop's creation year (the event only started
// being tracked from creation, it didn't retroactively happen every year
// before that).
export function occursOnDay(capture: Capture, dayKey: string): boolean {
  if (getEventDateKey(capture) === dayKey) return true;
  if (!capture.recurring || !capture.eventAt) return false;

  const eventKey = getEventDateKey(capture);
  if (!eventKey) return false;

  const dayMonthDay = dayKey.slice(5);
  const dayYear = Number(dayKey.slice(0, 4));
  const createdYear = new Date(capture.createdAt).getFullYear();

  return eventKey.slice(5) === dayMonthDay && dayYear >= createdYear;
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

export type TimelineOccurrence = {
  capture: Capture;
  occurrenceDate: string; // ISO
  isProjected: boolean;
};

// Every occurrence (real one-time resolved Drops, plus synthetic
// recurring projections) up through `throughYear`, chronologically
// sorted. Bounded by year so the timeline can extend this incrementally
// as the user scrolls (infinite-scroll-forward) instead of trying to
// generate unbounded output in one call. Regenerates the full list each
// time rather than diffing incrementally - for a personal app's realistic
// data volume this is cheap even across many years.
export function buildOccurrences(captures: Capture[], throughYear: number): TimelineOccurrence[] {
  const occurrences: TimelineOccurrence[] = [];

  for (const capture of captures) {
    if (!capture.eventAt) continue;

    if (!capture.recurring) {
      occurrences.push({ capture, occurrenceDate: capture.eventAt, isProjected: false });
      continue;
    }

    const createdYear = new Date(capture.createdAt).getFullYear();
    const firstYear = new Date(capture.eventAt).getFullYear();
    const startYear = Math.max(createdYear, firstYear);

    for (let year = startYear; year <= throughYear; year++) {
      const iso = year === firstYear ? capture.eventAt : projectToYear(capture, year);
      if (!iso) continue;
      occurrences.push({ capture, occurrenceDate: iso, isProjected: year !== firstYear });
    }
  }

  return occurrences.sort(
    (a, b) => new Date(a.occurrenceDate).getTime() - new Date(b.occurrenceDate).getTime()
  );
}
