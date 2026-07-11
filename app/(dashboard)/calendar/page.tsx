"use client";

import { useMemo, useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";
import DropDetailModal from "@/app/components/DropDetailModal";
import AgendaGrid from "@/app/components/AgendaGrid";

export default function CalendarPage() {
  const { captures, capturesLoading } = useCaptures();
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const resolvedCaptures = useMemo(
    () => captures.filter((capture) => capture.eventStatus === "resolved" && capture.eventAt),
    [captures]
  );

  const unresolvedCaptures = useMemo(
    () => captures.filter((capture) => capture.eventStatus === "unresolved"),
    [captures]
  );

  return (
    <main className="flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">
          Calendar
        </h1>

        {capturesLoading ? (
          <p className="text-gray-500 text-center">Loading your calendar…</p>
        ) : (
          <>
            <AgendaGrid captures={resolvedCaptures} onSelectCapture={setSelectedCaptureId} />

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📋 Needs your input</h2>

              {unresolvedCaptures.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing needs a date right now.</p>
              ) : (
                <ul className="space-y-2">
                  {unresolvedCaptures.map((capture) => (
                    <li key={capture.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCaptureId(capture.id)}
                        className="w-full text-left bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 hover:ring-amber-300 transition-all"
                      >
                        <p className="text-sm font-semibold text-amber-700">
                          ⚠️ Date unclear
                          {capture.temporalRawText ? ` — "${capture.temporalRawText}"` : ""}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {capture.title ?? capture.text}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {selectedCapture && (
        <DropDetailModal capture={selectedCapture} onClose={() => setSelectedCaptureId(null)} />
      )}
    </main>
  );
}
