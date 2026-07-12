"use client";

import { useState } from "react";
import type { Capture } from "@/app/lib/captures";
import LifelineDropCard from "./LifelineDropCard";

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

// Always computes the calendar day in the capture's own recorded
// event_timezone, never the viewer's local zone or raw UTC - a date-only
// event (event_has_time: false) must land on the same day for every
// viewer regardless of where they're looking from. Falls back to UTC only
// if event_timezone is missing or isn't a value Intl recognizes.
function getEventDateKey(capture: Capture): string | null {
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

// Supplementary label only - never modifies DropCard itself. Same
// timezone-safe approach as getEventDateKey: always formats in the
// capture's own event_timezone, falling back to UTC if that value is
// missing or invalid, rather than the viewer's local zone.
function formatEventTime(capture: Capture): string {
  if (!capture.eventHasTime || !capture.eventAt) return "All day";

  const date = new Date(capture.eventAt);
  const timezone = capture.eventTimezone || "UTC";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildTwoWeeks(anchor: Date): [Date[], Date[]] {
  const start = startOfWeek(anchor);
  const thisWeek: Date[] = [];
  const nextWeek: Date[] = [];

  for (let i = 0; i < 14; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    (i < 7 ? thisWeek : nextWeek).push(day);
  }

  return [thisWeek, nextWeek];
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

// Adapted from WeekStrip's day-grid pattern: same layout/styling
// conventions, but groups by event_at (in each capture's own
// event_timezone) instead of created_at, and renders the day-detail list
// as full LifelineDropCards instead of plain text lines. Callers are
// expected to pass only event_status === 'resolved' captures - this
// component just groups whatever it's given.
export default function AgendaGrid({
  captures,
  onSelectCapture,
}: {
  captures: Capture[];
  onSelectCapture: (id: number) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const [thisWeek, nextWeek] = buildTwoWeeks(addDays(today, weekOffset * 7));

  // A recurring Drop's stored event_at only holds ONE resolved occurrence
  // (the next upcoming one at the time it was detected) - projecting it
  // onto every year this grid renders (by month/day, in the capture's own
  // event_timezone, matching how getEventDateKey already works) means it
  // doesn't need to be re-created or re-resolved as years pass. Never
  // projected before the Drop's creation year - the event only started
  // being tracked from creation, it didn't retroactively happen every
  // year before that.
  function capturesForDay(day: Date) {
    const dayKey = getLocalDateKey(day);
    const dayMonthDay = dayKey.slice(5);
    const dayYear = Number(dayKey.slice(0, 4));

    return captures.filter((capture) => {
      if (getEventDateKey(capture) === dayKey) return true;

      if (!capture.recurring || !capture.eventAt) return false;

      const eventKey = getEventDateKey(capture);
      if (!eventKey) return false;

      const createdYear = new Date(capture.createdAt).getFullYear();
      return eventKey.slice(5) === dayMonthDay && dayYear >= createdYear;
    });
  }

  const selectedCaptures = selectedDate ? capturesForDay(selectedDate) : [];

  function DayCell({ day }: { day: Date }) {
    const dayCaptures = capturesForDay(day);
    const isToday = getLocalDateKey(day) === getLocalDateKey(today);
    const isSelected = selectedDate
      ? getLocalDateKey(day) === getLocalDateKey(selectedDate)
      : false;
    const dotColor = dotColorForDay(dayCaptures);

    return (
      <button
        onClick={() => setSelectedDate(isSelected ? null : day)}
        className={`flex flex-col items-center py-2 rounded-2xl transition-all ${
          isToday
            ? "bg-amber-400 text-gray-900 shadow-md"
            : isSelected
              ? "bg-amber-100 text-gray-900"
              : "text-gray-600 hover:bg-amber-50"
        }`}
      >
        <span className="text-[10px] font-medium">
          {day.toLocaleDateString(undefined, { weekday: "short" })}
        </span>
        <span className="text-base font-bold">{day.getDate()}</span>

        <div className="flex items-center justify-center mt-1 h-2">
          {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-3">
        <h3 className="font-semibold text-sm sm:text-base text-gray-900">Upcoming</h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekOffset((offset) => offset - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((offset) => offset + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {thisWeek.map((day) => (
          <DayCell key={day.toISOString()} day={day} />
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mt-1">
        {nextWeek.map((day) => (
          <DayCell key={day.toISOString()} day={day} />
        ))}
      </div>

      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="font-semibold text-gray-900 mb-2">
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>

          {selectedCaptures.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing scheduled this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedCaptures.map((capture) => (
                <div key={capture.id}>
                  <p className="text-xs font-semibold text-amber-700 mb-1 px-1">
                    🕐 {formatEventTime(capture)}
                    {capture.recurring ? " · 🎂 Every year" : ""}
                  </p>
                  <LifelineDropCard capture={capture} onSelect={onSelectCapture} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
