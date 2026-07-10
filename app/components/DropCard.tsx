"use client";

import { useEffect, useRef, useState } from "react";
import DropContent from "./DropContent";
import { getSpaceTone } from "@/app/lib/spaceTone";
import { formatRelativeTime } from "@/app/lib/relativeTime";

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
  size = "default",
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
  size?: "default" | "hero";
}) {
  const tone = getSpaceTone(spaceId);
  const isHero = size === "hero";
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
        collapsing
          ? "max-h-0 opacity-0 !p-0 !border-0"
          : `max-h-[20000px] opacity-100 ${isHero ? "p-8" : "p-5"}`
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          {onTitleTap ? (
            <button type="button" onClick={onTitleTap} className="block w-full text-left">
              <p
                className={`font-bold text-gray-900 ${isHero ? "text-2xl" : "text-lg"}`}
              >
                {title}
              </p>
            </button>
          ) : (
            <p className={`font-bold text-gray-900 ${isHero ? "text-2xl" : "text-lg"}`}>
              {title}
            </p>
          )}
        </div>

        <span
          className={`relative flex shrink-0 items-center justify-center rounded-full ${
            isHero ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"
          }`}
          title={tone.name}
        >
          <span
            className={`flex h-full w-full items-center justify-center rounded-full ${tone.color}`}
          >
            {tone.icon}
          </span>
          {isUrgent && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white"
              title="Urgent"
            />
          )}
        </span>
      </div>

      <div
        ref={contentRef}
        className={`mt-2 text-gray-800 overflow-hidden ${isHero ? "text-xl" : "text-base"}`}
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
