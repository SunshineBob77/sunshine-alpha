"use client";

import { useEffect, useRef, useState } from "react";
import DropContent from "./DropContent";
import { defaultSpaces } from "@/app/lib/spaces";
import { formatRelativeTime } from "@/app/lib/relativeTime";

const unassignedSpaceTone = {
  name: "Unsorted",
  icon: "📦",
  color: "bg-gray-100",
  border: "border-gray-300",
};

function getSpaceTone(spaceId: string | null | undefined) {
  const space = defaultSpaces.find((candidate) => candidate.id === spaceId);
  return space ?? unassignedSpaceTone;
}

const MAX_COLLAPSED_HEIGHT = 160;
// Card stays fully visible in its filled "Completed" state before it starts
// leaving the current view - long enough to read as a deliberate status
// change, not a disappearance.
const SETTLE_MS = 2800;

export default function DropCard({
  title,
  spaceId,
  content,
  createdAt,
  isUrgent = false,
  clipped = true,
  onTitleTap,
  actions,
  isActionable = false,
  status = "active",
  onToggleStatus,
}: {
  title: string;
  spaceId: string | null | undefined;
  content: string;
  createdAt: string;
  isUrgent?: boolean;
  clipped?: boolean;
  onTitleTap?: () => void;
  actions?: React.ReactNode;
  isActionable?: boolean;
  status?: "active" | "completed" | "deleted";
  onToggleStatus?: () => void;
}) {
  const tone = getSpaceTone(spaceId);
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > MAX_COLLAPSED_HEIGHT);
  }, [content]);

  const isClippedNow = clipped && !expanded;
  const isCompleted = status === "completed";
  const showCompletedToggle = isActionable && onToggleStatus;

  function handleToggleTap() {
    if (!onToggleStatus) return;
    onToggleStatus();

    // Whichever direction this just toggled, the card is about to leave the
    // current view (default Lifeline when completing, the Completed Space
    // when un-completing) - hold it visible in its new state briefly first.
    setCollapsing(false);
    setTimeout(() => setCollapsing(true), SETTLE_MS);
  }

  return (
    <div
      className={`bg-white rounded-2xl border-[5px] ${tone.border} shadow-sm transition-all duration-500 ease-in-out overflow-hidden ${
        collapsing ? "max-h-0 opacity-0 !p-0 !border-0" : "max-h-[2000px] opacity-100 p-5"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${tone.color}`}
        >
          {tone.icon}
        </span>
        <span className="text-xs font-semibold text-gray-600">{tone.name}</span>
        {isUrgent && <span className="h-2 w-2 rounded-full bg-red-500 ml-auto" title="Urgent" />}
      </div>

      {onTitleTap ? (
        <button type="button" onClick={onTitleTap} className="block w-full text-left">
          <p className="font-bold text-lg text-gray-900">{title}</p>
        </button>
      ) : (
        <p className="font-bold text-lg text-gray-900">{title}</p>
      )}

      <div
        ref={contentRef}
        className="mt-2 text-base text-gray-800 overflow-hidden"
        style={isClippedNow ? { maxHeight: MAX_COLLAPSED_HEIGHT } : undefined}
      >
        <DropContent content={content} />
      </div>

      {clipped && isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-sm font-semibold text-amber-700 mt-1.5"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <p className="text-sm text-gray-500 mt-3">{formatRelativeTime(createdAt)}</p>

      {(actions || showCompletedToggle) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          {showCompletedToggle && (
            <button
              type="button"
              onClick={handleToggleTap}
              aria-label={isCompleted ? "Mark as active" : "Mark as completed"}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                isCompleted
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              {isCompleted ? "● Completed" : "○ Completed"}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
