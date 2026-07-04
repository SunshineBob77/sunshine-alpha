"use client";

import { useState } from "react";
import type { Capture } from "@/app/lib/captures";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function buildTwoWeeks(today: Date): [Date[], Date[]] {
  const start = startOfWeek(today);
  const thisWeek: Date[] = [];
  const nextWeek: Date[] = [];

  for (let i = 0; i < 14; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    (i < 7 ? thisWeek : nextWeek).push(day);
  }

  return [thisWeek, nextWeek];
}

export default function WeekStrip({ captures }: { captures: Capture[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const today = new Date();
  const [thisWeek, nextWeek] = buildTwoWeeks(today);

  function capturesForDay(day: Date) {
    return captures.filter((capture) => isSameDay(new Date(capture.createdAt), day));
  }

  const selectedCaptures = selectedDate ? capturesForDay(selectedDate) : [];

  function DayCell({ day }: { day: Date }) {
    const dayCaptures = capturesForDay(day);
    const isToday = isSameDay(day, today);
    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
    const hasUrgent = dayCaptures.some((capture) => capture.tags?.includes("urgent"));

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

        <div className="flex items-center gap-0.5 mt-1 h-2">
          {hasUrgent ? (
            <span className="w-2 h-2 rounded-full bg-red-600" />
          ) : dayCaptures.length === 0 ? null : (
            Array.from({ length: Math.min(dayCaptures.length, 3) }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-red-500" />
            ))
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-4">
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
            <p className="text-sm text-gray-500">Nothing captured this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedCaptures.map((capture) => (
                <li key={capture.id} className="text-sm text-gray-700">
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
