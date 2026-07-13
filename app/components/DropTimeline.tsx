"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Capture } from "@/app/lib/captures";
import { buildOccurrences } from "@/app/lib/recurringProjection";
import { getSpaceTone } from "@/app/lib/spaceTone";
import { useCaptures } from "@/app/lib/DashboardContext";

function formatOccurrenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatOccurrenceTime(capture: Capture, iso: string): string {
  if (!capture.eventHasTime) return "All day";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const MONTHS_PER_PAGE = 6;
// Minimum time between automatic window extensions. Without this, a
// sentinel that's still intersecting right after a state update (which
// happens whenever real dated content is sparse - one extension doesn't
// add enough height to push the sentinel out of the intersection zone)
// fires again on the very next paint frame, compounding every ~16ms until
// the window rockets decades into the future in well under a second. This
// caps growth to a human-perceptible rate regardless of data density -
// the actual bug found in testing (screenshot showed entries out to 2066+
// on initial load, with no scrolling at all).
const EXTEND_COOLDOWN_MS = 300;

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Compact/summary cards, not full Drop content - tapping opens the real
// thing via DropDetailModal (through onSelectCapture), same as everywhere
// else in the app. "Infinite scroll forward" is a bounded date-window that
// extends itself in MONTHS_PER_PAGE-month steps (via IntersectionObserver
// on a bottom sentinel, cooldown-guarded per above) rather than trying to
// enumerate anything truly unbounded - recurring Drops get re-projected
// further out only as the window actually grows.
export default function DropTimeline({
  captures,
  scrollToDate,
  onSelectCapture,
}: {
  captures: Capture[];
  scrollToDate: Date | null;
  onSelectCapture: (id: number) => void;
}) {
  const { spaceOverrides } = useCaptures();
  const [throughDate, setThroughDate] = useState(() => addMonths(new Date(), MONTHS_PER_PAGE));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const extendingRef = useRef(false);
  // The cooldown alone bounds the growth RATE but not whether it grows at
  // all - with genuinely sparse data (a handful of recurring Drops), the
  // sentinel can stay inside the intersection zone indefinitely even after
  // extending, since a few more months of sparse entries still isn't
  // enough height to push it out of range. Without this, that means slow
  // but truly unbounded auto-growth with the page just sitting open, never
  // actually scrolled - not "only as the user scrolls." Requiring a fresh
  // scroll event before each automatic extension ties growth strictly to
  // real scrolling. Programmatic scrollIntoView from the month-view tap-to-
  // jump also fires native scroll events, so a tap that lands near the end
  // of the loaded window can still trigger one extension - that's correct,
  // not a bug (the user just jumped near the edge of loaded content).
  const hasScrolledRef = useRef(false);

  // buildOccurrences is year-granular (recurring projections are
  // inherently yearly) - generate through the window's year, then slice
  // down to the actual month-level cutoff so what's RENDERED matches the
  // real window size, not just what's generated.
  const occurrences = useMemo(() => {
    const all = buildOccurrences(captures, throughDate.getFullYear());
    const cutoff = throughDate.getTime();
    return all.filter((occurrence) => new Date(occurrence.occurrenceDate).getTime() <= cutoff);
  }, [captures, throughDate]);

  function extendWindow() {
    if (extendingRef.current) return;
    extendingRef.current = true;
    setThroughDate((date) => addMonths(date, MONTHS_PER_PAGE));
    // Require a new scroll before the NEXT extension too, not just before
    // this one - otherwise a sentinel that's still in range after this
    // extension would auto-extend again once the cooldown below expires.
    hasScrolledRef.current = false;
    window.setTimeout(() => {
      extendingRef.current = false;
    }, EXTEND_COOLDOWN_MS);
  }

  useEffect(() => {
    function handleScroll() {
      hasScrolledRef.current = true;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasScrolledRef.current) extendWindow();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Scroll-sync with the month view: if the tapped date is beyond the
  // currently-loaded window, extend the window first (this effect re-runs
  // once throughDate updates and the matching entry actually exists), then
  // scroll to the nearest occurrence on or after that date.
  useEffect(() => {
    if (!scrollToDate) return;

    if (scrollToDate.getTime() > throughDate.getTime()) {
      setThroughDate(addMonths(scrollToDate, MONTHS_PER_PAGE));
      return;
    }

    const dayKey = scrollToDate.toISOString().slice(0, 10);
    const match = occurrences.find((occurrence) => occurrence.occurrenceDate.slice(0, 10) >= dayKey);
    if (!match) return;

    const key = `${match.capture.id}-${match.occurrenceDate}`;
    entryRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToDate, throughDate, occurrences]);

  if (occurrences.length === 0) {
    return <p className="text-sm text-gray-500 text-center mt-6">No dated Drops yet.</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      {occurrences.map((occurrence) => {
        const key = `${occurrence.capture.id}-${occurrence.occurrenceDate}`;
        const spaceId = occurrence.capture.spaceIds?.[0];
        const tone = getSpaceTone(spaceId);
        const displayName = spaceOverrides[spaceId ?? ""] ?? tone.name;

        return (
          <div
            key={key}
            ref={(el) => {
              if (el) entryRefs.current.set(key, el);
              else entryRefs.current.delete(key);
            }}
          >
            <button
              type="button"
              onClick={() => onSelectCapture(occurrence.capture.id)}
              className="w-full text-left bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-3 hover:ring-amber-300 transition-all flex items-center gap-3"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${tone.color}`}
                title={displayName}
              >
                {tone.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-700">
                  {formatOccurrenceDate(occurrence.occurrenceDate)} ·{" "}
                  {formatOccurrenceTime(occurrence.capture, occurrence.occurrenceDate)}
                  {occurrence.capture.recurring
                    ? occurrence.capture.recurrenceType === "yearly"
                      ? " · 🎂"
                      : " · 🔁"
                    : ""}
                </p>
                <p className="text-sm text-gray-900 font-medium truncate">
                  {occurrence.capture.title ?? occurrence.capture.sunshineSummary}
                </p>
              </div>
            </button>
          </div>
        );
      })}

      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
