"use client";

import { useCaptures } from "@/app/lib/DashboardContext";
import { useInviteShare } from "@/app/lib/useInviteShare";
import NavLink from "./NavLink";

export default function DashboardHeader() {
  const { openCapture } = useCaptures();
  const { status: inviteStatus, handleInvite } = useInviteShare();

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-amber-50/95 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-3">
      <div className="w-full max-w-2xl mx-auto flex items-end justify-end gap-3">
        <button
          type="button"
          onClick={handleInvite}
          disabled={inviteStatus === "sharing"}
          className="flex flex-col items-center gap-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-400 text-white shadow-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 21a8 8 0 0 1 13.292-6" />
              <circle cx="10" cy="8" r="5" />
              <path d="M19 16v6" />
              <path d="M22 19h-6" />
            </svg>
          </span>
          {inviteStatus === "sharing"
            ? "…"
            : inviteStatus === "copied"
              ? "Copied!"
              : inviteStatus === "error"
                ? "Couldn't share"
                : "Invite"}
        </button>

        <button
          type="button"
          onClick={openCapture}
          aria-label="Drop"
          className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg shadow-amber-300/60 text-white text-3xl font-bold ring-4 ring-white transition-transform hover:scale-105"
        >
          +
        </button>

        <NavLink href="/me" label="Me" icon="🙂" />
      </div>
    </header>
  );
}
