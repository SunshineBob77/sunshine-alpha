"use client";

import { useShareCapture } from "@/app/lib/useShareCapture";
import type { Capture } from "@/app/lib/captures";

// variant: "light" (default) is the existing, unchanged appearance - used
// by DropDetailModal, which doesn't pass this prop. "dark" is scoped to
// the Lifeline feed screen's restyle only.
export default function ShareButton({
  capture,
  variant = "light",
}: {
  capture: Capture;
  variant?: "light" | "dark";
}) {
  const { status, manualLink, handleShare } = useShareCapture(capture);
  const isDark = variant === "dark";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleShare}
        disabled={status === "sharing"}
        className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all disabled:opacity-60 ${
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
          className={`text-xs rounded-lg px-2 py-1 w-56 border ${
            isDark
              ? "text-ink-dim bg-ink/5 border-ink/12"
              : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
        />
      )}
    </div>
  );
}
