"use client";

import Link from "next/link";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useInviteShare } from "@/app/lib/useInviteShare";

// Target: 55-60px total (h-14 = 56px). Logo, search, invite, "+", profile -
// no greeting/weather/quote (moved out per spec, no replacement here). "+"
// here is a compact icon (h-9), intentionally distinct from the large
// emphasized floating "+" in BottomNav - both are live at once, on purpose,
// so capture is reachable from either the header or the bottom nav.
export default function DashboardHeader() {
  const { openCapture } = useCaptures();
  const { status: inviteStatus, handleInvite } = useInviteShare();

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-14 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8">
      <div className="w-full max-w-2xl mx-auto h-full flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="Sunshine home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-lg"
        >
          ☀️
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          {/* Search has no destination/functionality yet - visual placeholder
              only, per the header layout requirement. Not wired to anything. */}
          <button
            type="button"
            aria-label="Search"
            title="Search (coming soon)"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-black/5 transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          <button
            type="button"
            onClick={openCapture}
            aria-label="Drop"
            title="New Drop"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-lg font-bold shadow-sm transition-transform hover:scale-105"
          >
            +
          </button>

          <button
            type="button"
            onClick={handleInvite}
            disabled={inviteStatus === "sharing"}
            aria-label="Invite a friend"
            title="Invite"
            className="flex h-9 items-center justify-center gap-1 rounded-full px-2 text-gray-600 hover:bg-black/5 transition-colors disabled:opacity-40"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 21a8 8 0 0 1 13.292-6" />
              <circle cx="10" cy="8" r="5" />
              <path d="M19 16v6" />
              <path d="M22 19h-6" />
            </svg>
            {inviteStatus !== "idle" && (
              <span className="text-xs font-semibold whitespace-nowrap">
                {inviteStatus === "sharing"
                  ? "…"
                  : inviteStatus === "copied"
                    ? "Copied!"
                    : "Error"}
              </span>
            )}
          </button>

          <Link
            href="/me"
            aria-label="Profile"
            title="Me"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-black/5 transition-colors text-lg"
          >
            🙂
          </Link>
        </div>
      </div>
    </header>
  );
}
