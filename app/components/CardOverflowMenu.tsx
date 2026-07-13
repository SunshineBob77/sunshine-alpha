"use client";

import { useEffect, useRef, useState } from "react";

// Generic "..." overflow trigger for actions that don't need top-level
// visibility in a card's primary action row (currently just Delete).
// Deliberately does NOT close on an inner click - DeleteDropButton's own
// confirm/cancel step lives inside this menu, and closing on every click
// would yank that confirm UI away before the user could see or use it.
// Only closes on an outside click, or naturally when the card itself
// unmounts after a successful delete.
export default function CardOverflowMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="More actions"
        aria-expanded={open}
        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full transition-all"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-max bg-white rounded-2xl shadow-lg ring-1 ring-black/5 p-1.5 flex flex-col items-stretch gap-1">
          {children}
        </div>
      )}
    </div>
  );
}
