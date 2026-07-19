"use client";

import { useLayoutEffect, useRef, useState } from "react";
import DailyBriefContent from "./DailyBriefContent";
import {
  computeSpaceDropCounts,
  computeCategoryCounts,
  computeCompletionStats,
} from "@/app/lib/dailyBriefStats";
import type { DailyBriefSpaceActivity } from "@/app/lib/dailyBrief";
import type { Capture } from "@/app/lib/captures";
import type { MySpace } from "@/app/lib/sharedSpaces";

// Purpose-built mini-carousel for the Daily Brief's own content area only
// - deliberately NOT a reuse of DropGroupCarousel.tsx. That component is
// built around independent, stateful DropCards sharing a real group_id,
// and needs infinite-loop clone machinery (leading/trailing clones,
// scrollend-triggered silent jump-back) specifically because that list's
// length can change. This is a small, FIXED set of pages within ONE
// system Drop's own content (today's activity, then a few live stat
// views) - no wraparound needed; swiping past either end just stops,
// like any ordinary paged UI.
function PagedCarousel({ pages }: { pages: React.ReactNode[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Explicit pixel height of the scroll container, tracking only the
  // active page's own content - undefined only until the very first
  // layout-effect measurement below runs (which happens before the
  // browser paints, so there's no visible flash of the wrong height).
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Re-measures whenever the active page changes (a swipe) or the pages
  // themselves change (fresh Daily Brief data) - items-start below stops
  // the flex row's default `align-items: stretch` from forcing every
  // page to the tallest one's height, so this always reflects the active
  // page's OWN natural height, not whichever page happens to be tallest.
  // useLayoutEffect specifically (not useEffect) so the height is correct
  // before paint - no flash of the old page's height on swipe.
  useLayoutEffect(() => {
    const activeEl = pageRefs.current[activeIndex];
    if (activeEl) setHeight(activeEl.scrollHeight);
  }, [activeIndex, pages]);

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ height }}
        className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth transition-[height] duration-300 ease-in-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, index) => (
          <div
            key={index}
            ref={(el) => {
              pageRefs.current[index] = el;
            }}
            className="w-full shrink-0 snap-center"
          >
            {page}
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to page ${index + 1} of ${pages.length}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "bg-gold w-4" : "bg-ink/20 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-dim mb-2">{children}</p>
  );
}

function SpaceTotalsPage({
  captures,
  userId,
  sharedSpaces,
  onNavigateToSpace,
}: {
  captures: Capture[];
  userId: string;
  sharedSpaces: MySpace[];
  onNavigateToSpace: (spaceId: string) => void;
}) {
  const counts = computeSpaceDropCounts(captures, userId, sharedSpaces);

  return (
    <div>
      <PageLabel>
        Spaces · {sharedSpaces.length} Shared Space{sharedSpaces.length === 1 ? "" : "s"}
      </PageLabel>
      {counts.length === 0 ? (
        <p className="text-ink-dim">No Drops yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {counts.map((space) => (
            <li key={space.spaceId}>
              <button
                type="button"
                onClick={() => onNavigateToSpace(space.spaceId)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 text-left transition-all hover:bg-ink/5"
              >
                <span className="text-base shrink-0">{space.spaceIcon}</span>
                <span className="min-w-0 leading-relaxed">
                  <span className="font-semibold">{space.spaceName}:</span> {space.count} Drop
                  {space.count === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryBreakdownPage({ captures, userId }: { captures: Capture[]; userId: string }) {
  const counts = computeCategoryCounts(captures, userId);

  return (
    <div>
      <PageLabel>Categories</PageLabel>
      {counts.length === 0 ? (
        <p className="text-ink-dim">No Drops yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {counts.map(({ category, count }) => (
            <li key={category} className="flex items-center justify-between">
              <span>{category}</span>
              <span className="text-ink-dim">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletionStatsPage({ captures, userId }: { captures: Capture[]; userId: string }) {
  const { completed, active } = computeCompletionStats(captures, userId);

  return (
    <div>
      <PageLabel>Completion</PageLabel>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="text-base shrink-0">✅</span>
          <span>{completed} completed</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-base shrink-0">🔲</span>
          <span>{active} active</span>
        </li>
      </ul>
    </div>
  );
}

// Page 1 is the existing, unchanged DailyBriefContent (Card 1 - today's
// per-Space activity delta, server-generated/frozen once a day). Pages
// 2-4 are new, computed live on every render from data already loaded in
// DashboardContext - see dailyBriefStats.ts's header for why these don't
// need generation-time storage the way Card 1 does.
export default function DailyBriefCarousel({
  activity,
  captures,
  userId,
  sharedSpaces,
  onNavigateToSpace,
}: {
  activity: DailyBriefSpaceActivity[];
  captures: Capture[];
  userId: string;
  sharedSpaces: MySpace[];
  onNavigateToSpace: (spaceId: string) => void;
}) {
  return (
    <PagedCarousel
      pages={[
        <DailyBriefContent key="activity" items={activity} onNavigateToSpace={onNavigateToSpace} />,
        <SpaceTotalsPage
          key="spaces"
          captures={captures}
          userId={userId}
          sharedSpaces={sharedSpaces}
          onNavigateToSpace={onNavigateToSpace}
        />,
        <CategoryBreakdownPage key="categories" captures={captures} userId={userId} />,
        <CompletionStatsPage key="completion" captures={captures} userId={userId} />,
      ]}
    />
  );
}
