"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCaptures } from "@/app/lib/DashboardContext";
import { buildOccurrences, dateKeyInZone } from "@/app/lib/recurringProjection";

const STRIP_DAYS = 14;

function localDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

// Home screen v1 - a compact preview, not the full /calendar tab (month
// grid + timeline). Same eligibility as /calendar's own resolvedCaptures
// (eventStatus "resolved" + eventAt, no completed/hidden/archived
// exclusion - unlike Reminders/TodaysFocusCard, this is meant to mirror
// "what's on my calendar", not "what still needs attention today"), and
// the same buildOccurrences() projection so a recurring Drop's future
// occurrences show up here too, not just its original anchor date.
export default function TwoWeekCalendarStrip() {
  const { captures } = useCaptures();
  const router = useRouter();

  const days = useMemo(() => {
    const today = new Date();
    const todayKey = localDateKey(today);

    const eligible = captures.filter((capture) => capture.eventStatus === "resolved" && capture.eventAt);
    const occurrences = buildOccurrences(eligible, today.getFullYear() + 1);
    const datesWithDrops = new Set(
      occurrences.map((occurrence) =>
        dateKeyInZone(occurrence.occurrenceDate, occurrence.capture.eventTimezone)
      )
    );

    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const key = localDateKey(date);
      return { key, date, isToday: key === todayKey, hasDrops: datesWithDrops.has(key) };
    });
  }, [captures]);

  return (
    <section className="rounded-2xl bg-dusk ring-1 ring-ink/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-dim">Next 2 Weeks</h2>
        <button
          type="button"
          onClick={() => router.push("/calendar")}
          className="text-xs font-semibold text-gold hover:text-peach"
        >
          Full calendar →
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => router.push("/calendar")}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl min-w-[44px] px-2.5 py-2 transition-all ${
              day.isToday ? "bg-gold text-night" : "bg-ink/5 hover:bg-ink/10 text-ink"
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
              {day.date.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="text-base font-bold leading-none">{day.date.getDate()}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                day.hasDrops ? (day.isToday ? "bg-night" : "bg-gold") : "bg-transparent"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
