"use client";

import { useState } from "react";
import type { Capture } from "@/app/lib/captures";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function buildUpcomingTwoWeeks(today: Date) {
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    return day;
  });
}

export default function WeekStrip({ captures }: { captures: Capture[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const today = new Date();
  const days = buildUpcomingTwoWeeks(today);

  function capturesForDay(day: Date) {
    return captures.filter((capture) => isSameDay(new Date(capture.createdAt), day));
  }

  const selectedCaptures = selectedDate ? capturesForDay(selectedDate) : [];

  return (
    <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-4">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {days.map((day) => {
          const dayCaptures = capturesForDay(day);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasUrgent = dayCaptures.some((capture) => capture.tags?.includes("urgent"));

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={`w-14 shrink-0 flex flex-col items-center py-2 rounded-2xl transition-all ${
                isToday
                  ? "bg-amber-400 text-gray-900 shadow-md"
                  : isSelected
                    ? "bg-amber-100 text-gray-900"
                    : "text-gray-600 hover:bg-amber-50"
              }`}
            >
              <span className="text-xs font-medium">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-lg font-bold">{day.getDate()}</span>

              <div className="flex items-center gap-0.5 mt-1 h-2.5">
                {hasUrgent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                ) : dayCaptures.length === 0 ? null : dayCaptures.length <= 3 ? (
                  Array.from({ length: dayCaptures.length }).map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  ))
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] font-semibold text-red-500 ml-0.5">
                      +{dayCaptures.length - 3}
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
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
