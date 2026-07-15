"use client";

import { useRef, useState } from "react";
import type { DropAttachment } from "@/app/lib/captures";

// Instagram-style horizontal swipe with dot indicators, built on native
// CSS scroll-snap rather than a carousel library (none exists in this
// codebase's dependencies) - overflow-x-auto + snap-mandatory also gives
// "swiping past the last slide bounces back" for free, via the browser's
// own scroll-bounds/rubber-band physics, with no manual gesture math.
//
// mainSlide is whatever the card would have rendered anyway (checklist
// or plain content) - it's always the FIRST slide here, with attachments
// appended after it. The parent Drop's own content is never replaced by
// its attachments, only extended by them.
export default function DropAttachmentCarousel({
  mainSlide,
  attachments,
  variant,
}: {
  mainSlide: React.ReactNode;
  attachments: DropAttachment[];
  variant: "light" | "dark";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const slideCount = attachments.length + 1;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-full shrink-0 snap-center">{mainSlide}</div>

        {attachments.map((attachment) => (
          <div key={attachment.id} className="w-full shrink-0 snap-center">
            <p
              className={`break-words leading-relaxed ${
                variant === "dark" ? "text-ink" : "text-gray-800"
              }`}
            >
              {attachment.content}
            </p>
          </div>
        ))}
      </div>

      {slideCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {Array.from({ length: slideCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to slide ${index + 1} of ${slideCount}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex
                  ? variant === "dark"
                    ? "bg-gold w-4"
                    : "bg-amber-500 w-4"
                  : variant === "dark"
                    ? "bg-ink/20 w-1.5"
                    : "bg-gray-300 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
