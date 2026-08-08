"use client";

import { useEffect, useRef, useState } from "react";
import DropContent from "./DropContent";
import ChecklistContent from "./ChecklistContent";
import { DropAttachmentImage, DropAttachmentFile } from "./DropAttachment";
import { getSpaceTone, sunshineDropTone, type SharedSpaceLookup } from "@/app/lib/spaceTone";
import { getSpaceColor, sunshineSpaceColor } from "@/app/lib/spaceColors";
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
  sharedSpaces = [],
  onInvite,
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
  analysisFailed = false,
  onRetryAnalysis,
}: {
  title: string;
  spaceId: string | null | undefined;
  // Defaults to [] - the public share page (app/s/[id]/page.tsx) has no
  // DashboardProvider/useCaptures() to source this from and never passes
  // it, same reasoning as variant defaulting to "light" there. Lets a
  // Drop whose primary space is a real Shared Space uuid resolve to that
  // Space's actual name/icon/color via getSpaceTone/getSpaceAccentColor
  // below, instead of falling through to the generic "Unsorted" tone.
  sharedSpaces?: SharedSpaceLookup[];
  // Present only when the caller has already confirmed the viewer owns
  // this Drop's primary Space (see LifelineDropCard) - DropCard itself
  // additionally re-checks isRealSharedSpace below before ever rendering
  // the eyebrow as a button, but ownership itself is the caller's call to
  // make, not this component's. Opens the same Invite modal already used
  // from the Shared Spaces list page, scoped to this Drop's Space,
  // directly from the collapsed card - no expand, no navigating away.
  // Deliberately NOT relocated into DropDetailModal's toolbar (Expanded
  // Drop detail view v1) - it's a Space-level action, not a Drop-level
  // one, so it stays exactly where it already was.
  onInvite?: () => void;
  content: string;
  createdAt: string;
  isUrgent?: boolean;
  clipped?: boolean;
  onTitleTap?: () => void;
  // Always-visible row content beyond the Completed toggle, distinct from
  // moreActions below (Share stays in the primary row; Delete/Archive/Undo
  // move into the collapsible More panel). Also doubles as the
  // suggestion-kind card's Accept/Dismiss buttons, which don't fit the
  // Complete/Share/Hide/More shape at all and need to stay directly
  // visible rather than tucked behind a trigger.
  extraPrimaryActions?: React.ReactNode;
  // Generically extensible - whatever's passed here renders inside the
  // collapsible "More" panel as-is (currently Delete/Archive/Undo; future
  // items just get added by the caller). Edit used to live here too, but
  // moved to DropDetailModal's own toolbar (Expanded Drop detail view v1)
  // alongside the header-row Edit shortcut it duplicated - see this file's
  // header-icon-row comment below for the fuller rationale.
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
  // Expanded Drop detail view v1 - Pin's own toggle button (and Edit's,
  // and "+"/add-to-group's) used to live in this card's header row.
  // They've moved into DropDetailModal's sticky toolbar instead (tap the
  // card to reach them) - isPinned stays here only for the display-only
  // ambient glow below (cardShadowClass), not for a control of its own
  // anymore.
  isPinned?: boolean;
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
  // Daily Brief). Content-based category/Space classification must
  // never determine how a Sunshine Drop card looks - this is a rendering
  // backstop, independent of whatever spaceId/category actually got
  // passed in, so a gap upstream (AI classification touching a system
  // Drop it shouldn't have) can never surface as a wrong-colored card.
  // See spaceTone.ts's sunshineDropTone/sunshineDropAccentColor.
  isSunshineDrop?: boolean;
  // Expanded Drop detail view v1 - re-added as a small quick-action icon
  // next to the Space badge, reachable without opening the full detail
  // view first. Pin/Edit stay modal-only (not re-added here) - this is
  // the one exception, since it's common enough to want directly from
  // the feed. Same "+" glyph/gating LifelineDropCard's onAddToGroup
  // already used before Pin/Edit/"+" all moved into the modal together -
  // deliberately independent of isOwnCapture (Shared Spaces' "friendly
  // invite" model means any active member can add to a group, not just
  // the Drop's own owner), and plain text, not the ➕ emoji - an emoji's
  // color is baked into the glyph itself and can't be recolored via CSS.
  onAddToGroup?: () => void;
  // Unified theme system v1 - these names are now slightly historical:
  // "dark" is the TOKEN-DRIVEN path (bg-dusk/text-ink/etc., which
  // globals.css makes resolve to the correct light-or-dark color
  // automatically based on the ambient data-theme attribute) - every
  // authenticated screen should use this, unconditionally, regardless of
  // which theme the user actually has selected. "light" (default) is a
  // fully hardcoded, theme-INDEPENDENT literal appearance, kept
  // specifically for the public share page (app/s/[id]/page.tsx), which
  // has no ThemeProvider/authenticated user to read a preference from at
  // all - it must always render the same way for every visitor. Flagging
  // the confusing naming rather than doing a wider prop-rename across
  // DropCard/LifelineDropCard/ShareButton/DeleteDropButton/
  // DropAttachmentImage/DropAttachmentFile/DropContent in this same pass.
  variant?: "light" | "dark";
  // Photo/Gallery/File capture v1 - at most one of these is ever set on a
  // real Drop (see Capture.imagePath/filePath in app/lib/captures.ts).
  // Rendered above the text content, never gated by clipped/expanded -
  // an attachment is always fully visible, only the text below it clips.
  imagePath?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  // Analyze-drop failure tracking v1 - true only when the analyze-drop
  // pass genuinely failed/never completed, never for a Drop the model
  // simply judged to have nothing more to add (that case looks like an
  // ordinary Drop, no badge). See docs/analysis-status-schema.sql.
  analysisFailed?: boolean;
  onRetryAnalysis?: () => void;
}) {
  // spaceId is intentionally ignored entirely when isSunshineDrop is true -
  // not just overridden after the fact - so a corrupted/stale spaceId can
  // never leak through even transiently.
  const tone = isSunshineDrop ? sunshineDropTone : getSpaceTone(spaceId, sharedSpaces);
  const spaceColor = isSunshineDrop ? sunshineSpaceColor : getSpaceColor(spaceId, sharedSpaces);
  // Drives both the "· Shared" suffix and whether the eyebrow below can
  // become the invite trigger at all - re-checked here independently of
  // whatever getSpaceTone/getSpaceAccentColor happened to resolve, so a
  // caller passing onInvite for a personal-space Drop by mistake still
  // can't make the eyebrow tappable.
  const isRealSharedSpace = !isSunshineDrop && sharedSpaces.some((candidate) => candidate.id === spaceId);
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

  // Dark (token-driven) variant: card differentiation is a core product
  // requirement, not a style preference - every Drop's card boundary
  // must read as unmistakably separate from the page at a glance. Solid
  // dusk (card token) background, not translucent, plus a full 2px
  // border in the Drop's own Space identity color (getSpaceColor - a
  // genuine per-Space runtime value, so it's applied via inline style
  // rather than a Tailwind class; Tailwind's static class scanning can't
  // generate a class for a color chosen at render time from a lookup).
  // Light variant now uses the SAME identity hex for its border too
  // (unified system - one Space, one hex, in both themes), just at a
  // thicker 5px width - that width difference (not the color) is the
  // one remaining thing distinguishing the two variants' borders. The
  // border no longer shifts to gold for pinned cards (that would compete
  // with the border's actual meaning - which Space this is) - pinned
  // emphasis is now carried entirely by this soft ambient gold glow
  // (shadow). Used to also be echoed by the header pin icon's own
  // highlight, but that icon moved into DropDetailModal's toolbar
  // (Expanded Drop detail view v1) - this glow is the only pinned
  // indicator left on the compact card itself.
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
      } ${cardShadowClass} ${
        collapsing
          ? "max-h-0 opacity-0 !p-0 !border-0"
          : `max-h-[20000px] opacity-100 ${isHero ? "p-8" : "p-4"}`
      }`}
      style={{ borderColor: spaceColor.identity }}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          {isDark &&
            (isRealSharedSpace && onInvite ? (
              // Shared-Space invite trigger - the eyebrow's own label IS
              // the entry point now, no separate icon/button needed.
              // Text/color/sizing intentionally identical to the plain
              // <p> below, just interactive - a Shared-Space Drop should
              // never look meaningfully different depending on whether
              // the viewer happens to own it.
              <button
                type="button"
                onClick={onInvite}
                className="text-[11px] font-bold uppercase tracking-wider mb-1 hover:underline"
                style={{ color: spaceColor.identity }}
              >
                {tone.name} · Shared
              </button>
            ) : (
              // Eyebrow - the border color's meaning (which Space this is)
              // needs to be legible on its own, not just decorative, so the
              // Space name repeats the same accent color in text. A real
              // Shared Space still gets the "· Shared" suffix even when
              // onInvite isn't present (a non-owner viewer, or a caller
              // that doesn't wire invites at all) - just not tappable.
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-1"
                style={{ color: spaceColor.identity }}
              >
                {isRealSharedSpace ? `${tone.name} · Shared` : tone.name}
              </p>
            ))}
          {onTitleTap ? (
            <button type="button" onClick={onTitleTap} className="block w-full text-left">
              <p
                className={`font-bold ${isDark ? `${fraunces.className} text-ink` : "text-gray-900"} ${isHero ? "text-2xl" : "text-lg"}`}
              >
                {title}
              </p>
            </button>
          ) : (
            <p
              className={`font-bold ${isDark ? `${fraunces.className} text-ink` : "text-gray-900"} ${isHero ? "text-2xl" : "text-lg"}`}
            >
              {title}
            </p>
          )}
        </div>

        {/* Expanded Drop detail view v1 - this header row used to also
            carry Pin and Edit icon buttons here; both moved into
            DropDetailModal's sticky bottom toolbar (tapping the title
            below opens that view) and stay modal-only. "+" (add to
            Carousel) came back as the one exception - see onAddToGroup's
            own doc comment above for why. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onAddToGroup && (
            <button
              type="button"
              onClick={onAddToGroup}
              aria-label="Add to this Drop's Carousel"
              title="Add to Carousel"
              // Plain "+" glyph, not an emoji character - an emoji's color
              // is baked into the glyph itself and can't be recolored via
              // CSS. Always a solid, explicitly-colored circle (no
              // low-opacity idle state), matching the always-visible
              // weight of the Space badge next to it.
              className={`flex shrink-0 items-center justify-center rounded-full font-bold leading-none transition-all ${
                isDark
                  ? "text-ink bg-ink/15 hover:bg-ink/25"
                  : "text-gray-900 bg-black/10 hover:bg-black/15"
              } ${isHero ? "h-9 w-9 text-xl" : "h-6 w-6 text-base"}`}
            >
              +
            </button>
          )}

          <span
            className={`relative flex shrink-0 items-center justify-center rounded-full ${
              isHero ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"
            }`}
            title={tone.name}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-full"
              style={{ backgroundColor: spaceColor.fill }}
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

      {(extraPrimaryActions ||
        moreActions ||
        showCompletedToggle ||
        showHideToggle ||
        (analysisFailed && onRetryAnalysis)) && (
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

            {analysisFailed && onRetryAnalysis && (
              <button
                type="button"
                onClick={onRetryAnalysis}
                title="Sunshine couldn't finish analyzing this Drop"
                className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                  isDark
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-700"
                }`}
              >
                ⚠️ Retry analysis
              </button>
            )}

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
