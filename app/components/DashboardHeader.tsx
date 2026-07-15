"use client";

import Image from "next/image";
import Link from "next/link";
import { useInviteShare } from "@/app/lib/useInviteShare";

// Target: 55-60px total (h-14 = 56px). Left: logo + "Sunshine" wordmark.
// Right, in order: an empty vacated slot (same width as the icon buttons,
// keeps the group's total width - and therefore Search/Invite/Me's
// position - unchanged from when the header "+" lived here) -> search
// (no label) -> invite (labeled) -> me (labeled, now at the far right
// edge). Capture is still reachable via the floating "+" in BottomNav.
//
// sunshine-logo.png is the real icon+wordmark lockup (cropped tight from
// the original asset, background keyed to transparent - the source file
// had an opaque near-white canvas with large padding, neither of which
// worked against this header's cream background).
export default function DashboardHeader() {
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
          {/* Vacated slot - the header "+" used to live here. Kept as an
              empty spacer (same footprint as a button) so removing it
              shifts Search/Invite/Me right instead of collapsing the
              group's width. */}
          <div aria-hidden="true" className="h-9 w-9" />

          {/* One search experience, reached from two places - this just
              routes to the Ask Sunshine tab (BottomNav's own entry point),
              not a separate search feature. No label, per spec -
              self-explanatory icon. */}
          <Link
            href="/ask"
            aria-label="Search"
            title="Search"
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
          </Link>

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
        </div>
      </div>
    </header>
  );
}
