"use client";

import { useCaptures } from "@/app/lib/DashboardContext";
import NavLink from "./NavLink";

const leftItems = [
  { href: "/", label: "Lifeline", icon: "🏠" },
  { href: "/spaces", label: "Spaces", icon: "🗂️" },
];

const rightItems = [
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/ask", label: "Ask Sunshine", icon: "💬" },
];

export default function BottomNav() {
  const { openCapture } = useCaptures();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur ring-1 ring-black/5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {leftItems.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}

      <button
        type="button"
        onClick={openCapture}
        aria-label="Drop"
        className="-mt-8 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg shadow-amber-300/60 text-white text-3xl font-bold ring-4 ring-white transition-transform hover:scale-105"
      >
        +
      </button>

      {rightItems.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
