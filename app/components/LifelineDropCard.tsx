"use client";

import DropCard from "./DropCard";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import DailyBriefContent from "./DailyBriefContent";
import DailyBriefSpacesContent from "./DailyBriefSpacesContent";
import DailyBriefCategoriesContent from "./DailyBriefCategoriesContent";
import DailyBriefCompletionContent from "./DailyBriefCompletionContent";
import { useCaptures } from "@/app/lib/DashboardContext";
import { isAutoHidden } from "@/app/lib/autoHide";
import {
  DAILY_BRIEF_ACTIVITY_TYPE,
  DAILY_BRIEF_SPACES_TYPE,
  DAILY_BRIEF_CATEGORIES_TYPE,
  DAILY_BRIEF_COMPLETION_TYPE,
} from "@/app/lib/systemDrops";
import type { Capture } from "@/app/lib/captures";

export default function LifelineDropCard({
  capture,
  onSelect,
  kind = "drop",
  onAccept,
  onDismiss,
  onToggleStatus,
  onToggleHide,
  onArchive,
  onUndo,
  onNavigateToSpace,
  onOpenInvite,
  variant = "dark",
}: {
  capture: Capture;
  // Opens the Drop's expanded detail view (DropDetailModal) - Edit used
  // to be a separate entry point that skipped straight into edit mode
  // (an `{ edit: true }` second argument here), but Edit now lives as its
  // own button inside that view's sticky toolbar instead of being a
  // second way to open it, so this only ever takes an id now.
  onSelect: (id: number) => void;
  kind?: "drop" | "suggestion";
  onAccept?: () => void;
  onDismiss?: () => void;
  onToggleStatus?: () => void;
  onToggleHide?: () => void;
  onArchive?: () => void;
  onUndo?: () => void;
  // Daily Brief carousel v1 - only ever read when this card is the
  // Activity or Spaces card (see the customContent branch below). The
  // Lifeline no longer renders Daily Brief cards at all (relocated to the
  // Me screen, see app/(dashboard)/me/page.tsx), so this is only ever
  // supplied there now - it routes to "/?space=<id>" (same deep-link
  // pattern the Organization tab already uses), not a local activeFilter
  // setter the way it briefly did when Daily Brief still lived here.
  onNavigateToSpace?: (spaceId: string) => void;
  // Shared-Space invite trigger v1 - page.tsx owns the actual
  // InviteSpaceModal/its open state; this just reports which Space to
  // open it for. Only ever wired into DropCard's onInvite when the
  // viewer owns that Space (see ownsPrimarySpace below) - a non-owner
  // never even gets a tappable eyebrow to begin with.
  onOpenInvite?: (spaceId: string) => void;
  // Defaults to "dark" - the Lifeline's own theme, unchanged from before
  // this prop existed. The Me screen's Daily Brief section (the only
  // other caller so far) passes "light" to match its light page theme.
  variant?: "light" | "dark";
}) {
  const { updateChecklistItems, retryAnalysis, user, sharedSpaces } = useCaptures();
  const isUrgent = capture.tags?.includes("urgent") ?? false;
  // Drives the handful of action-row buttons below that don't already
  // take a variant prop of their own (ShareButton/DeleteDropButton do) -
  // these were only ever hardcoded to dark styling because this component
  // only ever rendered on the Lifeline before the Me screen's Daily Brief
  // section (light) reused it.
  const isDark = variant === "dark";
  const isDrop = kind === "drop";
  const isSunshineDrop = capture.source === "system";
  const primarySpaceId = capture.spaceIds?.[0];
  const ownsPrimarySpace = sharedSpaces.some(
    (space) => space.id === primarySpaceId && space.role === "owner"
  );
  // Always true outside a shared space (a user only ever sees their own
  // captures there) - only meaningfully false when viewing a shared
  // space's Lifeline and looking at a Drop another member created. RLS
  // already rejects a write to someone else's capture regardless (see
  // the Shared Spaces audit - UPDATE/DELETE on captures is still
  // owner-only), so this is UI-layer only: it stops mutating controls
  // from rendering as if they'd work when they'd silently no-op.
  const isOwnCapture = capture.userId === user.id;
  // Manual marker (hiddenUntil is a presence flag now, not an expiry) OR
  // computed auto-hide for a dated Drop more than a week out - see
  // autoHide.ts. Drives the toggle button's own label/styling; tapping it
  // only ever flips the manual marker (see DropCard's onToggleHide).
  const isHiddenNow = capture.hiddenUntil !== null || isAutoHidden(capture);

  function handleToggleChecklistItem(itemId: string) {
    const next = capture.checklistItems.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateChecklistItems(capture.id, next);
  }

  return (
    <DropCard
      variant={variant}
      title={capture.title ?? capture.sunshineSummary}
      spaceId={primarySpaceId}
      sharedSpaces={sharedSpaces}
      onInvite={
        isDrop && ownsPrimarySpace && onOpenInvite && primarySpaceId
          ? () => onOpenInvite(primarySpaceId)
          : undefined
      }
      isSunshineDrop={isSunshineDrop}
      content={capture.formattedText ?? capture.text}
      createdAt={capture.createdAt}
      imagePath={capture.imagePath}
      filePath={capture.filePath}
      fileName={capture.fileName}
      // Analyze-drop failure tracking v1 - only for the viewer's own real
      // Drops, same gating as every other write action here (Hide, etc).
      // System Drops are always marked 'complete' server-side, so this
      // never fires for them regardless.
      analysisFailed={isDrop && isOwnCapture && capture.analysisStatus === "failed"}
      onRetryAnalysis={
        isDrop && isOwnCapture ? () => retryAnalysis(capture.id) : undefined
      }
      isUrgent={isUrgent}
      // Daily Brief carousel v1 - each of the 4 Daily Brief cards is now
      // its own independent system Drop (sharing one group_id, rendered
      // together via DropGroupCarousel in LifelineFeed.tsx), not one
      // capture with internally-paged content the way an earlier
      // same-night iteration built it. Each card swaps the default
      // markdown-rendered `content` above for its own structured
      // rendering, sourced from data frozen at generation time
      // (dailyBriefActivity / dailyBriefStats) - never recomputed here.
      // Every other system Drop (and every ordinary Drop) is untouched -
      // customContent stays undefined, same default markdown path as
      // always. onNavigateToSpace is only ever undefined if a caller
      // forgets to wire it; these rows would just no-op in that case
      // rather than throw, but every real caller passes it.
      customContent={
        capture.systemDropType === DAILY_BRIEF_ACTIVITY_TYPE ? (
          <DailyBriefContent
            items={capture.dailyBriefActivity ?? []}
            onNavigateToSpace={onNavigateToSpace ?? (() => {})}
          />
        ) : capture.systemDropType === DAILY_BRIEF_SPACES_TYPE &&
          capture.dailyBriefStats?.kind === "spaces" ? (
          <DailyBriefSpacesContent
            items={capture.dailyBriefStats.items}
            sharedSpaceCount={capture.dailyBriefStats.sharedSpaceCount}
            onNavigateToSpace={onNavigateToSpace ?? (() => {})}
          />
        ) : capture.systemDropType === DAILY_BRIEF_CATEGORIES_TYPE &&
          capture.dailyBriefStats?.kind === "categories" ? (
          <DailyBriefCategoriesContent items={capture.dailyBriefStats.items} />
        ) : capture.systemDropType === DAILY_BRIEF_COMPLETION_TYPE &&
          capture.dailyBriefStats?.kind === "completion" ? (
          <DailyBriefCompletionContent
            completed={capture.dailyBriefStats.completed}
            active={capture.dailyBriefStats.active}
          />
        ) : undefined
      }
      isActionable={capture.isActionable}
      status={capture.status}
      onToggleStatus={isDrop && isOwnCapture ? onToggleStatus : undefined}
      onTitleTap={() => onSelect(capture.id)}
      isPinned={capture.pinned}
      checklistItems={capture.checklistItems}
      onToggleChecklistItem={isOwnCapture ? handleToggleChecklistItem : undefined}
      isHidden={isHiddenNow}
      onToggleHide={isDrop && !isSunshineDrop && isOwnCapture ? onToggleHide : undefined}
      // Share is deliberately left ungated here - it wasn't in the
      // explicit "gate these" list, and the shares table's own RLS was
      // never audited this session, so gating it would be a guess rather
      // than a verified boundary. Flagging as an open question, not a
      // silent decision.
      extraPrimaryActions={
        kind === "suggestion" ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              className="text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-full transition-all"
            >
              ✓ Accept
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-3 py-1.5 rounded-full transition-all"
            >
              ✕ Dismiss
            </button>
          </>
        ) : (
          <ShareButton capture={capture} variant={variant} />
        )
      }
      // Delete was explicitly called out for gating - Archive and Undo
      // are bundled into this same panel and get gated along with it for
      // consistency (RLS already rejects a write to someone else's
      // capture regardless, so leaving those two ungated would just
      // reproduce the same "looks interactive, silently fails" gap for
      // two controls instead of none). Flagging this extension rather
      // than assuming it's what was meant. Edit used to have its own
      // entry here too (this "More" panel lives on the compact card
      // itself, independent of the modal) - removed as a duplicate of
      // opening the Drop's own detail view, which now has an Edit button
      // in its sticky toolbar (Expanded Drop detail view v1). Tapping the
      // title still opens that view exactly as before.
      moreActions={
        isDrop && isOwnCapture ? (
          <>
            <DeleteDropButton captureId={capture.id} variant={variant} />

            <button
              type="button"
              onClick={onArchive}
              className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
                isDark
                  ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              🗄️ Archive
            </button>

            <button
              type="button"
              onClick={onUndo}
              disabled={!capture.previousState}
              aria-label="Undo last change"
              className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              ↩️ Undo
            </button>
          </>
        ) : undefined
      }
    />
  );
}
