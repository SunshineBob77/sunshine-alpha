"use client";

import { useShareCapture } from "@/app/lib/useShareCapture";
import type { Capture } from "@/app/lib/captures";

export default function ShareButton({ capture }: { capture: Capture }) {
  const { status, manualLink, handleShare } = useShareCapture(capture);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleShare}
        disabled={status === "sharing"}
        className="text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1.5 rounded-full transition-all disabled:opacity-60"
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
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-56"
        />
      )}
    </div>
  );
}
