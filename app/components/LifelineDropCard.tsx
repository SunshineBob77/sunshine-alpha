"use client";

import { useState } from "react";
import DropContent from "./DropContent";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import type { Capture } from "@/app/lib/captures";

export default function LifelineDropCard({
  capture,
  onSelect,
  kind = "drop",
  onAccept,
  onDismiss,
}: {
  capture: Capture;
  onSelect: (id: number) => void;
  kind?: "drop" | "suggestion";
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  const [pinned, setPinned] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const isUrgent = capture.tags?.includes("urgent") ?? false;
  const visibleTags = (capture.tags ?? []).filter((tag) => tag !== "urgent");

  return (
    <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 hover:ring-black/10 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{capture.sunshineSummary}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {capture.category} · {new Date(capture.createdAt).toLocaleString()}
          </p>
        </div>

        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1.5 ${
            isUrgent ? "bg-red-500" : "bg-gray-300"
          }`}
          title={isUrgent ? "Urgent" : "Normal"}
        />
      </div>

      <button
        type="button"
        onClick={() => onSelect(capture.id)}
        className="mt-3 block w-full text-left"
      >
        <div className="max-h-24 overflow-hidden text-sm text-gray-800">
          <DropContent content={capture.formattedText ?? capture.text} />
        </div>
      </button>

      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        {kind === "suggestion" ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              className="text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full transition-all"
            >
              ✓ Accept
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-all"
            >
              ✕ Dismiss
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelect(capture.id)}
              className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-all"
            >
              ✏️ Edit
            </button>

            <ShareButton capture={capture} />

            <button
              type="button"
              onClick={() => setPinned((prev) => !prev)}
              aria-label={pinned ? "Unpin Drop" : "Pin Drop"}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                pinned
                  ? "bg-amber-200 text-amber-800"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              📌 {pinned ? "Pinned" : "Pin"}
            </button>

            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setShowMore((prev) => !prev)}
                aria-label="More actions"
                className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-all"
              >
                ⋯
              </button>

              {showMore && (
                <div className="absolute right-0 mt-2 z-10 bg-white rounded-xl ring-1 ring-black/10 shadow-lg p-2">
                  <DeleteDropButton
                    captureId={capture.id}
                    onDeleted={() => setShowMore(false)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
