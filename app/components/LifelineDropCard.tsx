"use client";

import DropCard from "./DropCard";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import { useCaptures } from "@/app/lib/DashboardContext";
import { isAutoHidden } from "@/app/lib/autoHide";
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
}: {
  capture: Capture;
  onSelect: (id: number) => void;
  kind?: "drop" | "suggestion";
  onAccept?: () => void;
  onDismiss?: () => void;
  onToggleStatus?: () => void;
  onToggleHide?: () => void;
  onArchive?: () => void;
  onUndo?: () => void;
}) {
  const { updatePinned, updateChecklistItems, addToGroup, user } = useCaptures();
  const isUrgent = capture.tags?.includes("urgent") ?? false;
  const isDrop = kind === "drop";
  const isSunshineDrop = capture.source === "system";
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

  function handleTogglePin() {
    updatePinned(capture.id, !capture.pinned);
  }

  function handleToggleChecklistItem(itemId: string) {
    const next = capture.checklistItems.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateChecklistItems(capture.id, next);
  }

  function handleAddToGroup() {
    return addToGroup(capture.id);
  }

  return (
    <DropCard
      variant="dark"
      title={capture.title ?? capture.sunshineSummary}
      spaceId={capture.spaceIds?.[0]}
      isSunshineDrop={isSunshineDrop}
      content={capture.formattedText ?? capture.text}
      createdAt={capture.createdAt}
      isUrgent={isUrgent}
      isActionable={capture.isActionable}
      status={capture.status}
      onToggleStatus={isDrop && isOwnCapture ? onToggleStatus : undefined}
      onTitleTap={() => onSelect(capture.id)}
      isPinned={capture.pinned}
      onTogglePin={isDrop && isOwnCapture ? handleTogglePin : undefined}
      checklistItems={capture.checklistItems}
      onToggleChecklistItem={isOwnCapture ? handleToggleChecklistItem : undefined}
      isHidden={isHiddenNow}
      onToggleHide={isDrop && !isSunshineDrop && isOwnCapture ? onToggleHide : undefined}
      // Deliberately NOT gated by isOwnCapture, unlike every other control
      // above - Card Carousel is explicitly the "friendly invite" model
      // (any active member of a Shared Space can add a new card to a
      // group belonging to a Drop in that space, not just its owner).
      // Still excluded for suggestion-kind cards and Sunshine Drops, same
      // as everything else.
      onAddToGroup={isDrop && !isSunshineDrop ? handleAddToGroup : undefined}
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
          <ShareButton capture={capture} variant="dark" />
        )
      }
      // Only Edit/Delete were explicitly called out for gating - Archive
      // and Undo are bundled into this same panel and get gated along
      // with it for consistency (RLS already rejects a write to someone
      // else's capture regardless, so leaving those two ungated would
      // just reproduce the same "looks interactive, silently fails" gap
      // for two controls instead of none). Flagging this extension
      // rather than assuming it's what was meant.
      moreActions={
        isDrop && isOwnCapture ? (
          <>
            <button
              type="button"
              onClick={() => onSelect(capture.id)}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2 py-1.5 rounded-full transition-all"
            >
              ✏️ Edit
            </button>

            <DeleteDropButton captureId={capture.id} variant="dark" />

            <button
              type="button"
              onClick={onArchive}
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2 py-1.5 rounded-full transition-all"
            >
              🗄️ Archive
            </button>

            <button
              type="button"
              onClick={onUndo}
              disabled={!capture.previousState}
              aria-label="Undo last change"
              className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↩️ Undo
            </button>
          </>
        ) : undefined
      }
    />
  );
}
