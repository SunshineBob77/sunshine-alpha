"use client";

import DropCard from "./DropCard";
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
  const isUrgent = capture.tags?.includes("urgent") ?? false;

  return (
    <DropCard
      title={capture.title ?? capture.sunshineSummary}
      spaceId={capture.spaceIds?.[0]}
      content={capture.formattedText ?? capture.text}
      createdAt={capture.createdAt}
      isUrgent={isUrgent}
      onTitleTap={() => onSelect(capture.id)}
      actions={
        kind === "suggestion" ? (
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

            <DeleteDropButton captureId={capture.id} />
          </>
        )
      }
    />
  );
}
