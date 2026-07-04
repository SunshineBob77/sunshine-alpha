"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaptures } from "@/app/lib/DashboardContext";

const leftItems = [{ href: "/", label: "Home", icon: "🏠" }, { href: "/spaces", label: "Spaces", icon: "🗂️" }];
const rightItems = [{ href: "/ask", label: "Ask Sunshine", icon: "💬" }, { href: "/me", label: "Me", icon: "🙂" }];

export default function BottomNav() {
  const pathname = usePathname();
  const { openCapture } = useCaptures();

  function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    const isActive = pathname === href;

    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-0.5 text-xs px-3 py-1 rounded-xl transition-colors ${
          isActive ? "text-amber-600 font-semibold" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <span className="text-xl leading-none">{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur ring-1 ring-black/5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {leftItems.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}

      <button
        onClick={openCapture}
        aria-label="Capture"
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
