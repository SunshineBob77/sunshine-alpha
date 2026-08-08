"use client";

import { useShareCapture } from "@/app/lib/useShareCapture";
import type { Capture } from "@/app/lib/captures";

// variant: "light" (default) is the existing, unchanged appearance - used
// by DropDetailModal, which doesn't pass this prop. "dark" is scoped to
// the Lifeline feed screen's restyle only.
export default function ShareButton({
  capture,
  variant = "light",
  size = "sm",
}: {
  capture: Capture;
  variant?: "light" | "dark";
  // Expanded Drop detail view v1 - "lg" (~1.5x) is scoped to
  // DropDetailModal's own toolbar, which sized every other button up at
  // the same time. LifelineDropCard's own usage doesn't pass this, so
  // the compact card's Share button keeps its original size unchanged.
  size?: "sm" | "lg";
}) {
  const { status, manualLink, handleShare } = useShareCapture(capture);
  const isDark = variant === "dark";
  const isLarge = size === "lg";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleShare}
        disabled={status === "sharing"}
        className={`${isLarge ? "text-lg px-4 py-2" : "text-xs px-2 py-1.5"} font-semibold rounded-full transition-all disabled:opacity-60 ${
          isDark
            ? "bg-gold/15 hover:bg-gold/25 text-peach"
            : "bg-amber-100 hover:bg-amber-200 text-amber-800"
        }`}
      >
        {status === "sharing" && "Sharing…"}
        {status === "copied" && "Copied!"}
        {status === "idle" && "🔗 Share"}
        {status === "error" && (manualLink ? "Copy link below" : "Couldn't share")}
      </button>

      {manualLink && (
        <input
          readOnly
          value={manualLink}
          onFocus={(event) => event.target.select()}
          className={`${isLarge ? "text-sm" : "text-xs"} rounded-lg px-2 py-1 w-56 border ${
            isDark
              ? "text-ink-dim bg-ink/5 border-ink/12"
              : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
        />
      )}
    </div>
  );
}
