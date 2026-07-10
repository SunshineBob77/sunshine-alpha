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
const COMPLETED_LABEL_MS = 700;

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
  const [justCompleted, setJustCompleted] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > MAX_COLLAPSED_HEIGHT);
  }, [content]);

  const isClippedNow = clipped && !expanded;
  const isChecked = status === "completed" || justCompleted;
  const showCheckbox = isActionable && onToggleStatus;

  function handleCheckboxTap() {
    if (!onToggleStatus) return;

    if (status === "completed") {
      onToggleStatus();
      return;
    }

    setJustCompleted(true);
    onToggleStatus();
    setTimeout(() => setCollapsing(true), COMPLETED_LABEL_MS);
  }

  return (
    <div
      className={`bg-white rounded-2xl border-[5px] ${tone.border} shadow-sm transition-all duration-500 ease-in-out overflow-hidden ${
        collapsing ? "max-h-0 opacity-0 !p-0 !border-0" : "max-h-[2000px] opacity-100 p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <div className="flex flex-col items-center shrink-0 mt-1">
            <button
              type="button"
              onClick={handleCheckboxTap}
              aria-label={status === "completed" ? "Mark as active" : "Mark as completed"}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                isChecked
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-gray-300 hover:border-gray-400 text-transparent"
              }`}
            >
              ✓
            </button>
            {justCompleted && !collapsing && (
              <span className="text-[10px] font-semibold text-emerald-600 mt-1 whitespace-nowrap">
                Completed
              </span>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${tone.color}`}
            >
              {tone.icon}
            </span>
            <span className="text-xs font-semibold text-gray-600">{tone.name}</span>
            {isUrgent && (
              <span className="h-2 w-2 rounded-full bg-red-500 ml-auto" title="Urgent" />
            )}
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

          {actions && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
