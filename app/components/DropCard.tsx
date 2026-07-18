"use client";

import { useEffect, useRef, useState } from "react";
import DropContent from "./DropContent";
import ChecklistContent from "./ChecklistContent";
import { DropAttachmentImage, DropAttachmentFile } from "./DropAttachment";
import { getSpaceTone, getSpaceAccentColor, sunshineDropTone, sunshineDropAccentColor } from "@/app/lib/spaceTone";
import { formatRelativeTime } from "@/app/lib/relativeTime";
import { hasUncheckedChecklistItems, type ChecklistItem } from "@/app/lib/captures";
import { fraunces } from "@/app/lib/fonts";

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
  isHidden = false,
  onToggleHide,
  size = "default",
  isPinned = false,
  onTogglePin,
  onEdit,
  checklistItems,
  onToggleChecklistItem,
  customContent,
  hideTimestamp = false,
  isSunshineDrop = false,
  onAddToGroup,
  variant = "light",
  imagePath = null,
  filePath = null,
  fileName = null,
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
  // Reflects the Drop's current effective hidden state (manual marker OR
  // computed auto-hide for a dated Drop - see isAutoHidden in
  // app/lib/autoHide.ts), for the toggle button's own label/styling.
  // Tapping it only ever flips the manual marker - see onToggleHide.
  isHidden?: boolean;
  // Single tap, no duration picker (Hide v2) - toggles the manual hidden
  // marker directly, no expandable panel. Absent entirely for Sunshine
  // Drop cards (system Drops never get a Hide control - caller's
  // responsibility, same as the isSunshineDrop rendering guard).
  onToggleHide?: () => void;
  size?: "default" | "hero";
  isPinned?: boolean;
  onTogglePin?: () => void;
  // Header-row Edit shortcut, grouped with "+" and Pin - renders the same
  // way onTogglePin does. Independent of the Edit entry inside moreActions
  // (callers may wire both to the same handler during the comparison
  // period; this component doesn't dedupe or prefer one over the other).
  onEdit?: () => void;
  checklistItems?: ChecklistItem[];
  onToggleChecklistItem?: (itemId: string) => void;
  // Escape hatch for structured content that isn't a flat checklist (the
  // Reminders card's two collapsible sections) - takes precedence over
  // both checklistItems and content when present.
  customContent?: React.ReactNode;
  // The Reminders card isn't a real capture, so "created 2h ago" wouldn't
  // mean anything - lets a caller opt out of that line entirely rather
  // than passing a misleading createdAt.
  hideTimestamp?: boolean;
  // True for system-generated Drops (capture.source === "system", e.g.
  // Morning Brief). Content-based category/Space classification must
  // never determine how a Sunshine Drop card looks - this is a rendering
  // backstop, independent of whatever spaceId/category actually got
  // passed in, so a gap upstream (AI classification touching a system
  // Drop it shouldn't have) can never surface as a wrong-colored card.
  // See spaceTone.ts's sunshineDropTone/sunshineDropAccentColor.
  isSunshineDrop?: boolean;
  // Card Carousel v2 - present whenever the caller wants the "+" trigger
  // available. Tapping it doesn't manage anything locally in this
  // component at all: it opens the ordinary global capture flow (owned
  // by DashboardContext), pre-wired to land the new capture in this
  // Drop's group. Rendering of the carousel itself (grouped Drops
  // swiping between each other) happens one level up, in LifelineFeed -
  // each member is a full independent DropCard, not content inside a
  // fixed one. Deliberately independent of isOwnCapture-style gating at
  // the caller level - Shared Spaces' "friendly invite" model means any
  // active member can add to a group, not just the Drop's own owner.
  onAddToGroup?: () => void;
  // "light" (default) is the existing, unchanged appearance - used by the
  // public share page (app/s/[id]/page.tsx), which doesn't pass this
  // prop. "dark" is scoped to the Lifeline feed screen's restyle only.
  variant?: "light" | "dark";
  // Photo/Gallery/File capture v1 - at most one of these is ever set on a
  // real Drop (see Capture.imagePath/filePath in app/lib/captures.ts).
  // Rendered above the text content, never gated by clipped/expanded -
  // an attachment is always fully visible, only the text below it clips.
  imagePath?: string | null;
  filePath?: string | null;
  fileName?: string | null;
}) {
  // spaceId is intentionally ignored entirely when isSunshineDrop is true -
  // not just overridden after the fact - so a corrupted/stale spaceId can
  // never leak through even transiently.
  const tone = isSunshineDrop ? sunshineDropTone : getSpaceTone(spaceId);
  const accentColor = isSunshineDrop ? sunshineDropAccentColor : getSpaceAccentColor(spaceId);
  const isHero = size === "hero";
  const isDark = variant === "dark";
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  // Only "More" expands into a panel now - Hide is a direct single-tap
  // toggle (see handleToggleHide below), so this no longer needs to be a
  // multi-value enum the way it did when Hide opened its own panel too.
  const [moreOpen, setMoreOpen] = useState(false);

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
    if (!moreOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreOpen]);

  const isClippedNow = clipped && !expanded;
  const isCompleted = status === "completed";
  const showCompletedToggle = isActionable && onToggleStatus;
  const showHideToggle = Boolean(onToggleHide);

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

  function handleToggleHide() {
    onToggleHide?.();
    settle();
  }

  // Dark variant: card differentiation is a core product requirement, not
  // a style preference - every Drop's card boundary must read as
  // unmistakably separate from the page at a glance. Solid dusk (gray)
  // background, not translucent, plus a full 2px border in the Drop's
  // own Space color (getSpaceAccentColor - a genuine per-Space runtime
  // value, so it's applied via inline style rather than a Tailwind
  // class; Tailwind's static class scanning can't generate a class for a
  // color chosen at render time from a ~12-entry lookup). The border no
  // longer shifts to gold for pinned cards (that would compete with the
  // border's actual meaning - which Space this is) - pinned emphasis is
  // now carried entirely by the soft ambient gold glow (shadow) plus the
  // header pin icon's own highlight.
  const cardShadowClass = isDark
    ? isPinned
      ? "shadow-[0_0_24px_rgba(240,163,57,0.18)]"
      : ""
    : "shadow-sm";

  return (
    <div
      ref={rootRef}
      className={`rounded-2xl transition-all duration-500 ease-in-out overflow-hidden ${
        isDark ? "bg-dusk border-2" : "bg-white border-[5px]"
      } ${isDark ? "" : tone.border} ${cardShadowClass} ${
        collapsing
          ? "max-h-0 opacity-0 !p-0 !border-0"
          : `max-h-[20000px] opacity-100 ${isHero ? "p-8" : "p-4"}`
      }`}
      style={isDark ? { borderColor: accentColor } : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          {isDark && (
            // Eyebrow - the border color's meaning (which Space this is)
            // needs to be legible on its own, not just decorative, so the
            // Space name repeats the same accent color in text.
            <p
              className="text-[11px] font-bold uppercase tracking-wider mb-1"
              style={{ color: accentColor }}
            >
              {tone.name}
            </p>
          )}
          {onTitleTap ? (
            <button type="button" onClick={onTitleTap} className="block w-full text-left">
              <p
                className={`font-bold ${isDark ? `${fraunces.className} text-white` : "text-gray-900"} ${isHero ? "text-2xl" : "text-lg"}`}
              >
                {title}
              </p>
            </button>
          ) : (
            <p
              className={`font-bold ${isDark ? `${fraunces.className} text-white` : "text-gray-900"} ${isHero ? "text-2xl" : "text-lg"}`}
            >
              {title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onAddToGroup && (
            <button
              type="button"
              onClick={onAddToGroup}
              aria-label="Add to this Drop's carousel"
              title="Add another card to this Drop"
              // Plain "+" glyph, not an emoji character - an emoji's color
              // is baked into the glyph itself and can't be recolored via
              // CSS. Always a solid, explicitly-colored circle (no
              // low-opacity idle state), matching the always-visible
              // weight of the Space badge next to it rather than Pin's
              // low-opacity-until-active treatment.
              className={`flex shrink-0 items-center justify-center rounded-full font-bold leading-none transition-all ${
                isDark
                  ? "text-white bg-ink/15 hover:bg-ink/25"
                  : "text-gray-900 bg-black/10 hover:bg-black/15"
              } ${isHero ? "h-9 w-9 text-xl" : "h-6 w-6 text-base"}`}
            >
              +
            </button>
          )}

          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={isPinned ? "Unpin" : "Pin"}
              title={isPinned ? "Unpin" : "Pin"}
              className={`flex shrink-0 items-center justify-center rounded-full transition-all ${
                isDark ? "hover:bg-ink/10" : "hover:bg-black/5"
              } ${
                isPinned
                  ? isDark
                    ? "opacity-100 bg-gold/20"
                    : "opacity-100 bg-amber-100"
                  : // Idle/unpinned state: the emoji glyph's own color can't be
                    // recolored via CSS, so contrast against the dusk card
                    // background has to come from opacity alone - 35% (fine
                    // against the light card) reads as nearly invisible on
                    // dusk, so the dark variant gets a higher idle floor.
                    isDark
                    ? "opacity-70 hover:opacity-100"
                    : "opacity-35 hover:opacity-70"
              } ${isHero ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"}`}
            >
              📌
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              title="Edit"
              className={`flex shrink-0 items-center justify-center rounded-full transition-all ${
                isDark ? "text-white hover:bg-ink/10" : "text-gray-900 hover:bg-black/5"
              } ${isHero ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"}`}
            >
              ✏️
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
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ${
                  isDark ? "ring-night" : "ring-white"
                }`}
                title="Urgent"
              />
            )}
          </span>
        </div>
      </div>

      {imagePath && (
        <div className="mt-1.5">
          <DropAttachmentImage imagePath={imagePath} variant={variant} />
        </div>
      )}
      {filePath && fileName && (
        <div className="mt-1.5">
          <DropAttachmentFile filePath={filePath} fileName={fileName} variant={variant} />
        </div>
      )}

      <div
        ref={contentRef}
        className={`mt-1.5 overflow-hidden ${isDark ? "text-ink" : "text-gray-800"} ${
          isHero ? "text-xl" : "text-base"
        }`}
        style={isClippedNow ? { maxHeight: MAX_COLLAPSED_HEIGHT } : undefined}
      >
        {customContent ? (
          customContent
        ) : checklistItems && checklistItems.length > 0 ? (
          <ChecklistContent
            items={checklistItems}
            onToggle={onToggleChecklistItem ?? (() => {})}
            readOnly={!onToggleChecklistItem}
          />
        ) : (
          <DropContent content={content} variant={variant} />
        )}
      </div>

      {clipped && isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`text-sm font-semibold mt-1 ${isDark ? "text-gold" : "text-amber-700"}`}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {!hideTimestamp && (
        <p className={`text-sm mt-2 ${isDark ? "text-ink-dim" : "text-gray-500"}`}>
          {formatRelativeTime(createdAt)}
        </p>
      )}

      {(extraPrimaryActions || moreActions || showCompletedToggle || showHideToggle) && (
        <div className={`mt-2 pt-2 border-t ${isDark ? "border-ink/10" : "border-gray-100"}`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {showCompletedToggle &&
              (confirmingComplete ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs ${isDark ? "text-ink-dim" : "text-gray-600"}`}>
                    This checklist still has unchecked items. Complete anyway?
                  </span>
                  <button
                    type="button"
                    onClick={commitToggleStatus}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                      isDark
                        ? "bg-gold hover:bg-gold/90 text-night"
                        : "bg-orange-500 hover:bg-orange-600 text-white"
                    }`}
                  >
                    Complete anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingComplete(false)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                      isDark
                        ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
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
                    isDark
                      ? isCompleted
                        ? "bg-gold text-night"
                        : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                      : isCompleted
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  }`}
                >
                  {isCompleted ? "● Completed" : "○ Completed"}
                </button>
              ))}

            {extraPrimaryActions}

            {showHideToggle && (
              <button
                type="button"
                onClick={handleToggleHide}
                aria-label={isHidden ? "Unhide" : "Hide"}
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  isDark
                    ? isHidden
                      ? "bg-gold text-night"
                      : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                    : isHidden
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                {isHidden ? "🙉 Unhide" : "🙈 Hide"}
              </button>
            )}

            {moreActions && (
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                aria-expanded={moreOpen}
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  isDark
                    ? moreOpen
                      ? "bg-gold text-night"
                      : "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                    : moreOpen
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                ⋯ More
              </button>
            )}
          </div>

          {moreOpen && moreActions && (
            <div className={`mt-2 pt-2 border-t ${isDark ? "border-ink/10" : "border-gray-100"}`}>
              {moreActions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
