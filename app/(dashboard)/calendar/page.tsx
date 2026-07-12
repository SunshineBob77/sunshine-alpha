"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";
import DropDetailModal from "@/app/components/DropDetailModal";
import CalendarMonthView from "@/app/components/CalendarMonthView";
import DropTimeline from "@/app/components/DropTimeline";

export default function CalendarPage() {
  const { captures, capturesLoading } = useCaptures();
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // "My Calendar" is the only real option - all of the user's dated Drops
  // across every Space combined (no per-Space filtering on this page).
  // "Shared" is a disabled coming-soon placeholder, so there's nothing
  // else to filter by yet - no per-Space pill list needed here anymore.
  const resolvedCaptures = useMemo(
    () => captures.filter((capture) => capture.eventStatus === "resolved" && capture.eventAt),
    [captures]
  );

  const unresolvedCaptures = useMemo(
    () => captures.filter((capture) => capture.eventStatus === "unresolved"),
    [captures]
  );

  // Same pattern as the Lifeline page's fixed filter row: measure the real
  // height of the fixed block (pill toolbar + month view) and use it as
  // the scrollable content's paddingTop, rather than a hardcoded guess -
  // the month view's height is fairly constant (fixed 6-row grid) but this
  // stays correct regardless. Positioned at top-14/z-30, exactly like the
  // Lifeline page's own second fixed bar: it starts precisely where the
  // global 56px DashboardHeader (also z-30) ends, so the two never
  // spatially overlap despite sharing a z-index tier, and both stay below
  // BottomNav's z-40 - the same invariant the earlier collision fix
  // established, unchanged by adding a third fixed element here.
  const fixedRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState(140);

  useLayoutEffect(() => {
    const el = fixedRef.current;
    if (!el) return;

    const updateHeight = () => setFixedHeight(el.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* No page title - the bottom nav calendar icon already establishes
          context. Pill toolbar + month view are fixed together here;
          only the timeline below scrolls. */}
      <div
        ref={fixedRef}
        className="fixed top-14 inset-x-0 z-30 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-2"
      >
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              className="shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-900 text-white"
            >
              My Calendar
            </button>
            <button
              type="button"
              disabled
              title="Shared calendars are coming soon"
              className="shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-gray-400 ring-1 ring-black/5 cursor-not-allowed"
            >
              👥 Shared — Coming Soon
            </button>
          </div>

          {!capturesLoading && (
            <CalendarMonthView
              captures={resolvedCaptures}
              displayMonth={displayMonth}
              onMonthChange={setDisplayMonth}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
        </div>
      </div>

      <main
        className="flex flex-col items-center p-4 sm:p-8"
        style={{ paddingTop: fixedHeight + 16 }}
      >
        <div className="w-full max-w-2xl">
          {capturesLoading ? (
            <p className="text-gray-500 text-center">Loading your calendar…</p>
          ) : (
            <>
              <DropTimeline
                captures={resolvedCaptures}
                scrollToDate={selectedDate}
                onSelectCapture={setSelectedCaptureId}
              />

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
    </>
  );
}
