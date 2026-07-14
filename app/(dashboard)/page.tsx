"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DropDetailModal from "@/app/components/DropDetailModal";
import LifelineFeed from "@/app/components/LifelineFeed";
import { useCaptures } from "@/app/lib/DashboardContext";
import { defaultSpaces } from "@/app/lib/spaces";

export default function Home() {
  const { captures, capturesLoading, capturesError, spaceOverrides } = useCaptures();
  const searchParams = useSearchParams();
  // Deep-link from the Organization tab: tapping a Space tile there routes
  // here with ?space=<id> pre-selected, since Organization no longer shows
  // a Space's Drops itself - this is the one place that still does.
  const requestedSpace = searchParams.get("space");
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;
  const [activeFilter, setActiveFilter] = useState(
    requestedSpace && defaultSpaces.some((space) => space.id === requestedSpace)
      ? requestedSpace
      : "all"
  );

  // Otherwise still defaultSpaces' fixed order (the pinned-first/recency
  // ordering rule applies to Organization and the calendar pill toolbar,
  // not this row) - "pinned" is pulled out and reinserted right after
  // "all" as the one deliberate exception, so it reads All, Pinned,
  // Personal, Work... instead of sitting next to Completed at the end.
  const filterOptions = useMemo(() => {
    const spaceOptions = defaultSpaces.map((space) => ({
      id: space.id,
      name: spaceOverrides[space.id] ?? space.name,
    }));
    const pinnedIndex = spaceOptions.findIndex((option) => option.id === "pinned");
    const pinnedOption = pinnedIndex === -1 ? null : spaceOptions.splice(pinnedIndex, 1)[0];

    return [
      { id: "all", name: "All" },
      ...(pinnedOption ? [pinnedOption] : []),
      ...spaceOptions,
    ];
  }, [spaceOverrides]);

  const headerRef = useRef<HTMLElement>(null);
  // Generous initial estimate so content isn't clipped before the ResizeObserver
  // below measures the real height on mount (useLayoutEffect corrects it pre-paint).
  const [headerHeight, setHeaderHeight] = useState(60);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeight = () => setHeaderHeight(el.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Filter row only - greeting/weather/quote removed per spec (that
          content now lives in a future Morning Brief System Drop, not
          replaced here). Positioned at top-14 to sit directly below the
          global 56px DashboardHeader. */}
      <header
        ref={headerRef}
        className="fixed top-14 inset-x-0 z-30 bg-night/90 backdrop-blur-md border-b border-ink/10 px-4 sm:px-8 py-2"
      >
        <div className="w-full max-w-2xl mx-auto flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveFilter(option.id)}
              className={`shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                activeFilter === option.id
                  ? "bg-gold text-night"
                  : "bg-ink/5 text-ink-dim ring-1 ring-ink/10 hover:ring-ink/20"
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </header>

      <main
        className="flex flex-col items-center p-4 sm:p-8 min-h-screen bg-gradient-to-b from-night to-dusk"
        style={{ paddingTop: headerHeight + 16 }}
      >
        <div className="w-full max-w-2xl">
          {capturesError && (
            <p className="text-sm text-red-400 mb-6 text-center">{capturesError}</p>
          )}

          {capturesLoading ? (
            <p className="text-ink-dim text-center">Loading your day…</p>
          ) : (
            <section>
              <LifelineFeed
                captures={captures}
                activeFilter={activeFilter}
                onSelectCapture={setSelectedCaptureId}
              />
            </section>
          )}
        </div>

        {selectedCapture && (
          <DropDetailModal
            capture={selectedCapture}
            onClose={() => setSelectedCaptureId(null)}
          />
        )}
      </main>
    </>
  );
}
