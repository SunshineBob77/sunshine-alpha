"use client";

import Image from "next/image";
import Link from "next/link";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useInviteShare } from "@/app/lib/useInviteShare";

// Target: 55-60px total (h-14 = 56px). Left: logo + "Sunshine" wordmark.
// Right, in order: search (no label) -> invite (labeled) -> me (labeled) ->
// "+" (no label, far right edge). "+" here is a compact icon (h-9),
// intentionally distinct from the large emphasized floating "+" in
// BottomNav - both are live at once, on purpose, so capture is reachable
// from either the header or the bottom nav.
//
// sunshine-logo.png is the real icon+wordmark lockup (cropped tight from
// the original asset, background keyed to transparent - the source file
// had an opaque near-white canvas with large padding, neither of which
// worked against this header's cream background).
export default function DashboardHeader() {
  const { openCapture } = useCaptures();
  const { status: inviteStatus, handleInvite } = useInviteShare();

  const inviteLabel =
    inviteStatus === "idle"
      ? "Invite"
      : inviteStatus === "sharing"
        ? "…"
        : inviteStatus === "copied"
          ? "Copied!"
          : "Error";

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-14 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8">
      <div className="w-full max-w-2xl mx-auto h-full flex items-center justify-between gap-3">
        <Link href="/" aria-label="Sunshine home" className="flex items-center shrink-0">
          <Image
            src="/sunshine-logo.png"
            alt="Sunshine"
            width={1276}
            height={358}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center gap-1 shrink-0">
          {/* Search has no destination/functionality yet - visual placeholder
              only, per the header layout requirement. Not wired to anything.
              No label, per spec - self-explanatory icon. */}
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
            onClick={handleInvite}
            disabled={inviteStatus === "sharing"}
            aria-label="Invite a friend"
            title="Invite"
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-gray-600 hover:bg-black/5 transition-colors disabled:opacity-40"
          >
            <svg
              width="16"
              height="16"
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
            <span className="text-[9px] font-semibold leading-none whitespace-nowrap">
              {inviteLabel}
            </span>
          </button>

          <Link
            href="/me"
            aria-label="Profile"
            title="Me"
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-gray-600 hover:bg-black/5 transition-colors"
          >
            <span className="text-base leading-none">🙂</span>
            <span className="text-[9px] font-semibold leading-none">Me</span>
          </Link>

          {/* Far right edge, no label - per spec. */}
          <button
            type="button"
            onClick={openCapture}
            aria-label="Drop"
            title="New Drop"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-lg font-bold shadow-sm transition-transform hover:scale-105"
          >
            +
          </button>
        </div>
      </div>
    </header>
  );
}
