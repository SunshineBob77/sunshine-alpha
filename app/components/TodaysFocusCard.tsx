"use client";

import { useMemo } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";
import { buildOccurrences, dateKeyInZone } from "@/app/lib/recurringProjection";
import { isEligible } from "@/app/lib/reminders";

// Home screen v1 - reuses reminders.ts's own isEligible (same "still
// relevant today" definition Reminders already established: resolved,
// not completed, not archived, not hidden) rather than a new one, then
// narrows buildOccurrences' projection down to just today's date. Unlike
// TwoWeekCalendarStrip (which mirrors /calendar's looser "anything
// scheduled" eligibility), this is meant to answer "what still needs my
// attention today", so completed/hidden/archived Drops are excluded.
export default function TodaysFocusCard({
  onSelectCapture,
}: {
  onSelectCapture: (id: number) => void;
}) {
  const { captures } = useCaptures();
  const todayKey = new Date().toLocaleDateString("en-CA");

  const items = useMemo(() => {
    const eligible = captures.filter(isEligible);
    const throughYear = Number(todayKey.slice(0, 4)) + 1;
    const occurrences = buildOccurrences(eligible, throughYear);

    return occurrences
      .filter(
        (occurrence) =>
          dateKeyInZone(occurrence.occurrenceDate, occurrence.capture.eventTimezone) === todayKey
      )
      .map((occurrence) => occurrence.capture);
  }, [captures, todayKey]);

  return (
    <section className="rounded-2xl bg-dusk ring-1 ring-ink/10 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
        🎯 Today&apos;s Focus
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-ink-dim">Nothing scheduled for today.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((capture) => (
            <li key={capture.id}>
              <button
                type="button"
                onClick={() => onSelectCapture(capture.id)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 text-left transition-all hover:bg-ink/5"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {capture.title ?? capture.sunshineSummary}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
