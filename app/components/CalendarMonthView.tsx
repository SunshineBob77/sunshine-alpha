"use client";

import type { Capture } from "@/app/lib/captures";
import { occursOnDay } from "@/app/lib/recurringProjection";

function getLocalDateKey(date: Date): string {
  // No timeZone option = the viewer's own local zone. Used only for grid
  // navigation (which day is "today", which cell is selected) - a UI
  // concern distinct from which day a capture's event belongs to.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  // Fixed 6 weeks (42 days) regardless of month length, so the grid never
  // changes height between months.
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

const categoryDotColor: Record<string, string> = {
  Achievement: "bg-emerald-500",
  Work: "bg-blue-500",
  Task: "bg-amber-500",
  Memory: "bg-purple-500",
};

function dotColorForDay(dayCaptures: Capture[]) {
  const hasUrgent = dayCaptures.some((capture) => capture.tags?.includes("urgent"));
  if (hasUrgent) return "bg-red-600";
  if (dayCaptures.length === 0) return null;
  return categoryDotColor[dayCaptures[0].category] ?? "bg-gray-400";
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Standard 6-row month grid. Tapping a day never opens anything inline
// here - it just reports the date up to the parent, which scrolls the
// timeline below to it. Recurring Drops are matched via occursOnDay,
// which projects onto every year this grid renders, not just the single
// year originally resolved.
export default function CalendarMonthView({
  captures,
  displayMonth,
  onMonthChange,
  selectedDate,
  onSelectDate,
}: {
  captures: Capture[];
  displayMonth: Date;
  onMonthChange: (month: Date) => void;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  const days = buildMonthGrid(displayMonth);

  function capturesForDay(day: Date) {
    const dayKey = getLocalDateKey(day);
    return captures.filter((capture) => occursOnDay(capture, dayKey));
  }

  function changeMonth(delta: number) {
    onMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + delta, 1));
  }

  function goToToday() {
    onMonthChange(new Date());
    onSelectDate(new Date());
  }

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900">
          {displayMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goToToday}
            className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-400 mb-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={index}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === displayMonth.getMonth();
          const dayCaptures = capturesForDay(day);
          const isToday = getLocalDateKey(day) === getLocalDateKey(today);
          const isSelected = selectedDate
            ? getLocalDateKey(day) === getLocalDateKey(selectedDate)
            : false;
          const dotColor = dotColorForDay(dayCaptures);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`flex flex-col items-center py-2 rounded-2xl transition-all ${
                inMonth ? "" : "opacity-30"
              } ${
                isToday
                  ? "bg-amber-400 text-gray-900 shadow-md"
                  : isSelected
                    ? "bg-amber-100 text-gray-900"
                    : "text-gray-600 hover:bg-amber-50"
              }`}
            >
              <span className="text-sm font-semibold">{day.getDate()}</span>
              <div className="flex items-center justify-center mt-1 h-2">
                {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
