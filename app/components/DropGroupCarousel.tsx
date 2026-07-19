"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Instagram-style horizontal swipe with dot indicators, built on native
// CSS scroll-snap rather than a carousel library (none exists in this
// codebase's dependencies).
//
// Unlike a text-content carousel, each slide here is a FULL, independent
// DropCard (with its own header/action row) - the caller (LifelineFeed)
// passes one already-rendered element per group member. Dots render in
// their own row below the whole scroll container, never overlaid inside
// any individual card.
//
// Loops in both directions for 2+ slides - the standard "clone the
// edges" technique: a clone of the LAST slide sits before the first real
// one, and a clone of the FIRST slide sits after the last real one, so
// swiping past either end lands on a clone that looks identical to the
// real thing. Once the browser's own scroll-snap settling finishes there
// (the native `scrollend` event - the right moment, since jumping mid-
// animation would visually fight the browser's own momentum/snap
// physics), the scroll position silently jumps, with no animation, to
// the real slide the clone stood in for - continued swiping in the same
// direction just keeps working, no dead end. This leans on real browser
// touch/momentum/snap physics rather than hand-rolled gesture detection,
// which is what makes it feel native on a phone.
//
// Trade-off worth knowing: since each slide is a full STATEFUL DropCard,
// a clone is a genuinely separate component instance from its real
// counterpart, not a visual copy. The underlying Drop data can never
// desync (both instances act on the same capture.id, same DashboardContext),
// but something purely-visual like "Show more" being expanded wouldn't
// carry over if someone managed to interact with a clone in the split
// second it's visible mid-swipe - negligible in practice, clones are
// never on-screen except during an active swipe gesture.
//
// Mobile/touch is the priority per instruction - this still works with a
// mouse (native scroll-snap responds to trackpad/wheel scrolling either
// way), but no custom desktop affordance (drag, arrow buttons) is built
// here; that's a separate, deprioritized pass.
//
// "Advance to the next non-completed card" (when a group member
// completes) still needs no special-case logic - see the shrink-effect
// below, unchanged in spirit from before looping was added.
export default function DropGroupCarousel({ slides }: { slides: React.ReactNode[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canLoop = slides.length > 1;

  // DOM position 0 is the leading clone (of the last real slide) only
  // when looping - without it, DOM position 0 IS the first real slide.
  const domOffset = canLoop ? 1 : 0;
  const [activeIndex, setActiveIndex] = useState(0);
  // Raw scroll-DOM index (unlike activeIndex, not clamped/re-mapped for
  // clones) - seeded from domOffset, not 0, so it matches where
  // scrollToDom's own mount-time effect below actually positions the
  // carousel. Height measurement keys off this rather than activeIndex:
  // during an active loop-jump a clone can briefly be the visible slide,
  // and this tracks whichever DOM position is really on-screen. A clone
  // and its real counterpart render the same slide content, so this
  // never measures a "wrong" height even when it points at a clone -
  // just occasionally a different component instance of the same Drop.
  const [activeDomIndex, setActiveDomIndex] = useState(domOffset);
  const displaySlides = canLoop ? [slides[slides.length - 1], ...slides, slides[0]] : slides;
  // Clamped for display only - activeIndex itself is never written to
  // directly from the shrink-effect below, only ever from a real scroll
  // event, so a momentarily-stale value can't render out-of-bounds dots
  // before that event catches up.
  const displayIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  // Explicit pixel height of the OUTER wrapper (see the JSX below, not
  // scrollRef itself) - tracks only the active slide's own content,
  // fixing the same "stretches to the tallest member" bug an earlier
  // same-night carousel had. Applied to a separate wrapper rather than
  // scrollRef directly - see that JSX comment for why animating height on
  // the actual scroll-snap element broke native swipe mid-gesture.
  // undefined only until the very first layout-effect measurement runs
  // (before the browser paints, so no flash).
  const [height, setHeight] = useState<number | undefined>(undefined);

  // useLayoutEffect specifically (not useEffect) so the height is correct
  // before paint - no flash of the wrong (tallest-member) height on
  // mount or on swipe.
  useLayoutEffect(() => {
    const activeEl = slideRefs.current[activeDomIndex];
    if (activeEl) setHeight(activeEl.scrollHeight);
  }, [activeDomIndex, displaySlides.length]);

  function scrollToDom(domIndex: number, smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: domIndex * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
  }

  // Positions on the first REAL slide before first paint - a fresh
  // scroll container otherwise defaults to scrollLeft 0, which would
  // show the leading clone (the last slide) instead of the first one.
  useLayoutEffect(() => {
    scrollToDom(domOffset, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const domIndex = Math.round(el.scrollLeft / el.clientWidth);
    const realIndex = domIndex - domOffset;

    setActiveDomIndex(domIndex);

    if (realIndex < 0) {
      setActiveIndex(slides.length - 1); // on the leading clone - dots show the last card
    } else if (realIndex > slides.length - 1) {
      setActiveIndex(0); // on the trailing clone - dots show the first card
    } else {
      setActiveIndex(realIndex);
    }
  }

  // The actual loop mechanism - see the file-level comment. Attached as a
  // real DOM listener (not a React onScrollEnd JSX prop) since scrollend
  // is a newer native event not universally guaranteed to have first-
  // class synthetic-event support.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !canLoop) return;

    function handleScrollEnd() {
      if (!el || el.clientWidth === 0) return;
      const domIndex = Math.round(el.scrollLeft / el.clientWidth);

      if (domIndex === 0) {
        scrollToDom(slides.length, false); // leading clone -> real last slide
      } else if (domIndex === displaySlides.length - 1) {
        scrollToDom(domOffset, false); // trailing clone -> real first slide
      }
    }

    el.addEventListener("scrollend", handleScrollEnd);
    return () => el.removeEventListener("scrollend", handleScrollEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, canLoop]);

  // Re-sync scroll position if the group shrinks (e.g. a member
  // completed and left the list) - pure DOM side effect, no direct
  // setState. displayIndex already renders safely against a momentarily
  // stale activeIndex; the re-scroll here fires a real scroll event, and
  // handleScroll (a normal event callback, not code running
  // synchronously inside this effect) is what actually updates
  // activeIndex, same as any user-driven swipe would.
  useEffect(() => {
    if (activeIndex > slides.length - 1) {
      scrollToDom(Math.max(0, slides.length - 1) + domOffset, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  return (
    <div>
      {/* Height animation lives on THIS wrapper, not on the scrollable
          element below - scrollRef (overflow-x-auto + snap-x, the actual
          target of native touch/scroll-snap physics) must never itself
          change size while a gesture is in progress, or the browser's
          snap-settling math gets destabilized mid-drag (confirmed live:
          swiping past the first card left an adjacent slide partially
          visible instead of snapping cleanly - handleScroll fires on
          every scroll tick, and re-triggering a height transition on the
          element being dragged is what broke it). scrollRef goes back to
          flex's default align-items: stretch below - a CONSTANT total
          height (every slide stretched to the tallest, same value
          regardless of which one is active) - and this wrapper's
          overflow-y-hidden + measured height crops that down to just the
          active slide's own content, exactly the same visual result,
          with the actual scrolling element's own box never moving. */}
      <div
        style={{ height }}
        className="overflow-y-hidden transition-[height] duration-300 ease-in-out"
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {displaySlides.map((slide, index) => (
            <div key={index} className="w-full shrink-0 snap-center">
              {/* Height is measured off THIS inner div, not the outer
                  slide div above - the outer one is a flex item under
                  scrollRef's default align-items: stretch, so its own
                  scrollHeight is forced to match the tallest sibling for
                  EVERY slide (confirmed empirically: a short slide's
                  outer scrollHeight reads identical to a tall slide's -
                  356 vs 356 - while this inner div, which isn't itself a
                  flex item, reads its own real content height - 18 vs
                  324). Measuring the outer div here would silently
                  reproduce the exact "every card renders at the tallest
                  member's height" bug this whole ref/height mechanism
                  exists to fix. */}
              <div
                ref={(el) => {
                  slideRefs.current[index] = el;
                }}
              >
                {slide}
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToDom(index + domOffset)}
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
