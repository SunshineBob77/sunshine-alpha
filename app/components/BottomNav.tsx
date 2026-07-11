"use client";

import NavLink from "./NavLink";

const items = [
  { href: "/", label: "Lifeline", icon: "🏠" },
  { href: "/spaces", label: "Spaces", icon: "🗂️" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/ask", label: "Ask Sunshine", icon: "💬" },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur ring-1 ring-black/5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
