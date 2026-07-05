"use client";

import { useState } from "react";
import type { Capture } from "@/app/lib/captures";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isFutureDay(day: Date, today: Date) {
  return startOfDay(day).getTime() > startOfDay(today).getTime();
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

export default function WeekStrip({ captures }: { captures: Capture[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const [thisWeek, nextWeek] = buildTwoWeeks(addDays(today, weekOffset * 7));

  function capturesForDay(day: Date) {
    return captures.filter((capture) => isSameDay(new Date(capture.createdAt), day));
  }

  const selectedCaptures = selectedDate ? capturesForDay(selectedDate) : [];

  function DayCell({ day }: { day: Date }) {
    const dayCaptures = capturesForDay(day);
    const isToday = isSameDay(day, today);
    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
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
        <h3 className="font-semibold text-sm sm:text-base text-gray-900">Two Weeks at a Glance</h3>

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
            <p className="text-sm text-gray-500">
              {isFutureDay(selectedDate, today) ? "No plans yet." : "Nothing dropped this day."}
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedCaptures.map((capture) => (
                <li key={capture.id} className="text-sm text-gray-700 break-words">
                  <span className="text-gray-400 mr-2">
                    {new Date(capture.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {capture.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
