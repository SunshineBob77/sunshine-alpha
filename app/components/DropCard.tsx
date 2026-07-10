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

export default function DropCard({
  title,
  spaceId,
  content,
  createdAt,
  isUrgent = false,
  clipped = true,
  onTitleTap,
  actions,
}: {
  title: string;
  spaceId: string | null | undefined;
  content: string;
  createdAt: string;
  isUrgent?: boolean;
  clipped?: boolean;
  onTitleTap?: () => void;
  actions?: React.ReactNode;
}) {
  const tone = getSpaceTone(spaceId);
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > MAX_COLLAPSED_HEIGHT);
  }, [content]);

  const isClippedNow = clipped && !expanded;

  return (
    <div
      className={`bg-white rounded-2xl border-[5px] ${tone.border} shadow-sm p-5 transition-all`}
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

      {actions && <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">{actions}</div>}
    </div>
  );
}
