"use client";

import { useMemo, useState } from "react";
import LifelineDropCard from "./LifelineDropCard";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";

// Matches DropCard's own settle time, so the card doesn't get yanked out of
// the list mid-animation - it finishes its own "stay visible, then leave"
// sequence before the parent filter actually drops it.
const SETTLE_MS = 3000;

export default function LifelineFeed({
  captures,
  activeFilter,
  onSelectCapture,
}: {
  captures: Capture[];
  activeFilter: string;
  onSelectCapture: (id: number) => void;
}) {
  const { updateStatus, hideCapture, archiveCapture, undoCaptureState } = useCaptures();
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  // Archived is checked first and short-circuits every other branch (tucked
  // away everywhere except its own Space) except the Archived filter
  // itself. hiddenUntil only ever gates the literal "all" Lifeline view -
  // a hidden Drop stays fully visible in its own Space, and in the
  // Completed/Pinned cross-cutting views, per spec.
  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      if (pendingRemovalIds.has(capture.id)) return true;

      const isArchived = capture.userArchivedAt !== null;
      if (activeFilter === "archived") return isArchived;
      if (isArchived) return false;

      if (activeFilter === "completed") return capture.status === "completed";
      if (activeFilter === "pinned") return capture.pinned === true;

      const isHiddenNow = Boolean(capture.hiddenUntil && new Date(capture.hiddenUntil) > new Date());
      if (activeFilter === "all" && isHiddenNow) return false;

      if (capture.status === "completed") return false;

      return activeFilter === "all" || capture.spaceIds?.includes(activeFilter);
    });
  }, [captures, activeFilter, pendingRemovalIds]);

  // Shared settle-then-remove helper - whichever action just fired, the
  // item may be about to leave the currently visible filtered view (or
  // move to a different one), so it stays visible through its own settle
  // animation first, same window DropCard's own internal collapse
  // animation uses (see DropCard.tsx's SETTLE_MS).
  function holdThroughSettle(id: number) {
    setPendingRemovalIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setPendingRemovalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, SETTLE_MS);
  }

  async function handleToggleStatus(id: number, currentStatus: Capture["status"]) {
    const nextStatus = currentStatus === "completed" ? "active" : "completed";
    holdThroughSettle(id);
    await updateStatus(id, nextStatus);
  }

  async function handleHide(id: number, duration: "today" | "week") {
    holdThroughSettle(id);
    await hideCapture(id, duration);
  }

  async function handleArchive(id: number) {
    holdThroughSettle(id);
    await archiveCapture(id);
  }

  async function handleUndo(id: number) {
    holdThroughSettle(id);
    await undoCaptureState(id);
  }

  if (filteredCaptures.length === 0) {
    return (
      <p className="text-ink-dim text-center mt-6">
        {activeFilter === "completed"
          ? "No completed Drops yet."
          : activeFilter === "archived"
            ? "No archived Drops yet."
            : activeFilter === "all"
              ? "No Drops yet."
              : "No Drops in this Space yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {filteredCaptures.map((capture) => (
        <LifelineDropCard
          key={capture.id}
          capture={capture}
          onSelect={onSelectCapture}
          onToggleStatus={() => handleToggleStatus(capture.id, capture.status)}
          onHideToday={() => handleHide(capture.id, "today")}
          onHideWeek={() => handleHide(capture.id, "week")}
          onArchive={() => handleArchive(capture.id)}
          onUndo={() => handleUndo(capture.id)}
        />
      ))}
    </div>
  );
}
