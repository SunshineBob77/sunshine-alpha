"use client";

import { useEffect, useRef, useState } from "react";

// Instagram-style horizontal swipe with dot indicators, built on native
// CSS scroll-snap rather than a carousel library (none exists in this
// codebase's dependencies) - overflow-x-auto + snap-mandatory also gives
// "swiping past the last slide bounces back" for free, via the browser's
// own scroll-bounds physics, with no manual gesture math.
//
// Unlike a text-content carousel, each slide here is a FULL, independent
// DropCard (with its own header/action row) - the caller (LifelineFeed)
// passes one already-rendered element per group member. Dots render in
// their own row below the whole scroll container, never overlaid inside
// any individual card.
//
// "Advance to the next non-completed card" needs no special-case logic:
// when a member completes, it stays in `slides` for its own SETTLE_MS
// fade-out (see DropCard/LifelineFeed's existing settle mechanism), then
// actually disappears once the parent's filter drops it - at that point
// `slides` shrinks by one. As long as the removed slide wasn't the
// active one, the scroll container's scrollLeft is left untouched, so
// the same numeric index now simply shows whatever slide shifted into
// it - the "next" card appears without any explicit re-scroll. The one
// case that does need explicit handling is removing the LAST slide while
// it was active, which would otherwise leave the view scrolled past the
// new end - handled by clamping and re-scrolling only then.
export default function DropGroupCarousel({ slides }: { slides: React.ReactNode[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Clamped for display only - activeIndex itself is never written to
  // directly from this shrink case (see the effect below), only ever from
  // a real scroll event, so a momentarily-stale value can't render
  // out-of-bounds dots before that event catches up.
  const displayIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function scrollToIndex(index: number, smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
  }

  useEffect(() => {
    // Pure DOM side effect, no direct setState - re-scrolling fires a
    // real scroll event, and handleScroll (a normal event callback, not
    // code running synchronously inside this effect) is what updates
    // activeIndex, same as any user-driven swipe would.
    if (activeIndex > slides.length - 1) {
      scrollToIndex(Math.max(0, slides.length - 1), false);
    }
    // Only re-run when the slide count actually changes - re-scrolling on
    // every activeIndex change (e.g. from the user's own swipe) would
    // fight the scroll the user just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div key={index} className="w-full shrink-0 snap-center">
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to card ${index + 1} of ${slides.length}`}
              className={`h-1.5 rounded-full transition-all ${
                index === displayIndex ? "bg-gold w-4" : "bg-ink/20 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
