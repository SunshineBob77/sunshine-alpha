"use client";

import DropCard from "./DropCard";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";

export default function LifelineDropCard({
  capture,
  onSelect,
  kind = "drop",
  onAccept,
  onDismiss,
  onToggleStatus,
  onHideToday,
  onHideWeek,
  onArchive,
  onUndo,
}: {
  capture: Capture;
  onSelect: (id: number) => void;
  kind?: "drop" | "suggestion";
  onAccept?: () => void;
  onDismiss?: () => void;
  onToggleStatus?: () => void;
  onHideToday?: () => void;
  onHideWeek?: () => void;
  onArchive?: () => void;
  onUndo?: () => void;
}) {
  const { updatePinned, updateChecklistItems } = useCaptures();
  const isUrgent = capture.tags?.includes("urgent") ?? false;
  const isDrop = kind === "drop";

  function handleTogglePin() {
    updatePinned(capture.id, !capture.pinned);
  }

  function handleToggleChecklistItem(itemId: string) {
    const next = capture.checklistItems.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateChecklistItems(capture.id, next);
  }

  return (
    <DropCard
      variant="dark"
      title={capture.title ?? capture.sunshineSummary}
      spaceId={capture.spaceIds?.[0]}
      content={capture.formattedText ?? capture.text}
      createdAt={capture.createdAt}
      isUrgent={isUrgent}
      isActionable={capture.isActionable}
      status={capture.status}
      onToggleStatus={isDrop ? onToggleStatus : undefined}
      onTitleTap={() => onSelect(capture.id)}
      isPinned={capture.pinned}
      onTogglePin={isDrop ? handleTogglePin : undefined}
      checklistItems={capture.checklistItems}
      onToggleChecklistItem={handleToggleChecklistItem}
      onHideToday={isDrop ? onHideToday : undefined}
      onHideWeek={isDrop ? onHideWeek : undefined}
      onArchive={isDrop ? onArchive : undefined}
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
      moreActions={
        isDrop ? (
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
