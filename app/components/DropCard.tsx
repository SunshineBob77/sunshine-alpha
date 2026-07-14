"use client";

import { useEffect, useRef, useState } from "react";
import DropContent from "./DropContent";
import ChecklistContent from "./ChecklistContent";
import HidePanel from "./HidePanel";
import { getSpaceTone } from "@/app/lib/spaceTone";
import { formatRelativeTime } from "@/app/lib/relativeTime";
import { hasUncheckedChecklistItems, type ChecklistItem } from "@/app/lib/captures";

const MAX_COLLAPSED_HEIGHT = 160;
// Card stays fully visible in its new state (Completed/Hidden/Archived)
// before it starts leaving the current view - long enough to read as a
// deliberate change, not a disappearance.
const SETTLE_MS = 2800;

export default function DropCard({
  title,
  spaceId,
  content,
  createdAt,
  isUrgent = false,
  clipped = true,
  onTitleTap,
  extraPrimaryActions,
  moreActions,
  isActionable = false,
  status = "active",
  onToggleStatus,
  onHideToday,
  onHideWeek,
  onArchive,
  size = "default",
  isPinned = false,
  onTogglePin,
  checklistItems,
  onToggleChecklistItem,
}: {
  title: string;
  spaceId: string | null | undefined;
  content: string;
  createdAt: string;
  isUrgent?: boolean;
  clipped?: boolean;
  onTitleTap?: () => void;
  // Always-visible row content beyond the Completed toggle, distinct from
  // moreActions below (Share stays in the primary row per Action Row v2;
  // Edit/Delete/Undo move into the collapsible More panel). Also doubles
  // as the suggestion-kind card's Accept/Dismiss buttons, which don't fit
  // the Complete/Share/Hide/More shape at all and need to stay directly
  // visible rather than tucked behind a trigger.
  extraPrimaryActions?: React.ReactNode;
  // Generically extensible - whatever's passed here renders inside the
  // collapsible "More" panel as-is (currently Edit/Delete/Undo; future
  // items like Duplicate/Move-to-Space just get added by the caller).
  moreActions?: React.ReactNode;
  isActionable?: boolean;
  status?: "active" | "completed" | "deleted";
  onToggleStatus?: () => void;
  onHideToday?: () => void;
  onHideWeek?: () => void;
  onArchive?: () => void;
  size?: "default" | "hero";
  isPinned?: boolean;
  onTogglePin?: () => void;
  checklistItems?: ChecklistItem[];
  onToggleChecklistItem?: (itemId: string) => void;
}) {
  const tone = getSpaceTone(spaceId);
  const isHero = size === "hero";
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<"hide" | "more" | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > MAX_COLLAPSED_HEIGHT);
  }, [content]);

  // Tapping elsewhere collapses whichever panel is open - scoped to this
  // card's own root (via rootRef.contains), not a global "any click
  // anywhere closes every card's panel" listener. In-flow content, not an
  // absolutely-positioned popover, so it isn't subject to the overflow-
  // hidden clipping issue the earlier standalone overflow-menu attempt hit.
  useEffect(() => {
    if (!expandedPanel) return;

    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setExpandedPanel(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [expandedPanel]);

  const isClippedNow = clipped && !expanded;
  const isCompleted = status === "completed";
  const showCompletedToggle = isActionable && onToggleStatus;
  const showHideTrigger = Boolean(onHideToday || onHideWeek || onArchive);

  function togglePanel(panel: "hide" | "more") {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  }

  function handleToggleTap() {
    if (!onToggleStatus) return;

    // Checklist state and Drop status are independent - unchecked items
    // never block completion, they just require the user to confirm once
    // before it happens. Un-completing never needs this (only guards the
    // active -> completed direction).
    if (!isCompleted && hasUncheckedChecklistItems(checklistItems ?? [])) {
      setConfirmingComplete(true);
      return;
    }

    commitToggleStatus();
  }

  function commitToggleStatus() {
    setConfirmingComplete(false);
    onToggleStatus?.();
    settle();
  }

  // Shared settle-then-leave for any action that moves this Drop out of
  // the current view (Complete, Hide, Archive) - holds the card visible
  // in its new state briefly before the parent list's own filter drops it.
  function settle() {
    setCollapsing(false);
    setTimeout(() => setCollapsing(true), SETTLE_MS);
  }

  function handleHideToday() {
    setExpandedPanel(null);
    onHideToday?.();
    settle();
  }

  function handleHideWeek() {
    setExpandedPanel(null);
    onHideWeek?.();
    settle();
  }

  function handleArchive() {
    setExpandedPanel(null);
    onArchive?.();
    settle();
  }

  return (
    <div
      ref={rootRef}
      className={`bg-white rounded-2xl border-[5px] ${tone.border} shadow-sm transition-all duration-500 ease-in-out overflow-hidden ${
        collapsing
          ? "max-h-0 opacity-0 !p-0 !border-0"
          : `max-h-[20000px] opacity-100 ${isHero ? "p-8" : "p-4"}`
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          {onTitleTap ? (
            <button type="button" onClick={onTitleTap} className="block w-full text-left">
              <p className={`font-bold text-gray-900 ${isHero ? "text-2xl" : "text-lg"}`}>
                {title}
              </p>
            </button>
          ) : (
            <p className={`font-bold text-gray-900 ${isHero ? "text-2xl" : "text-lg"}`}>
              {title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={isPinned ? "Unpin" : "Pin"}
              title={isPinned ? "Unpin" : "Pin"}
              className={`flex shrink-0 items-center justify-center rounded-full transition-all hover:bg-black/5 ${
                isPinned ? "opacity-100 bg-amber-100" : "opacity-35 hover:opacity-70"
              } ${isHero ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"}`}
            >
              📌
            </button>
          )}

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
      </div>

      <div
        ref={contentRef}
        className={`mt-1.5 text-gray-800 overflow-hidden ${isHero ? "text-xl" : "text-base"}`}
        style={isClippedNow ? { maxHeight: MAX_COLLAPSED_HEIGHT } : undefined}
      >
        {checklistItems && checklistItems.length > 0 ? (
          <ChecklistContent items={checklistItems} onToggle={onToggleChecklistItem ?? (() => {})} />
        ) : (
          <DropContent content={content} />
        )}
      </div>

      {clipped && isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-sm font-semibold text-amber-700 mt-1"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <p className="text-sm text-gray-500 mt-2">{formatRelativeTime(createdAt)}</p>

      {(extraPrimaryActions || moreActions || showCompletedToggle || showHideTrigger) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showCompletedToggle &&
              (confirmingComplete ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-600">
                    This checklist still has unchecked items. Complete anyway?
                  </span>
                  <button
                    type="button"
                    onClick={commitToggleStatus}
                    className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full transition-all"
                  >
                    Complete anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingComplete(false)}
                    className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleTap}
                  aria-label={isCompleted ? "Mark as active" : "Mark as completed"}
                  className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                    isCompleted
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? "● Completed" : "○ Completed"}
                </button>
              ))}

            {extraPrimaryActions}

            {showHideTrigger && (
              <button
                type="button"
                onClick={() => togglePanel("hide")}
                aria-expanded={expandedPanel === "hide"}
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  expandedPanel === "hide"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                🙈 Hide
              </button>
            )}

            {moreActions && (
              <button
                type="button"
                onClick={() => togglePanel("more")}
                aria-expanded={expandedPanel === "more"}
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  expandedPanel === "more"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                ⋯ More
              </button>
            )}
          </div>

          {expandedPanel && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {expandedPanel === "hide" ? (
                <HidePanel
                  onToday={handleHideToday}
                  onWeek={handleHideWeek}
                  onArchive={handleArchive}
                />
              ) : (
                moreActions
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
