"use client";

import { useMemo, useState } from "react";
import LifelineDropCard from "./LifelineDropCard";
import RemindersCard from "./RemindersCard";
import DropGroupCarousel from "./DropGroupCarousel";
import { useCaptures } from "@/app/lib/DashboardContext";
import { isAutoHidden } from "@/app/lib/autoHide";
import { groupCapturesByGroupId } from "@/app/lib/dropGroups";
import type { Capture } from "@/app/lib/captures";

// Matches DropCard's own settle time, so the card doesn't get yanked out of
// the list mid-animation - it finishes its own "stay visible, then leave"
// sequence before the parent filter actually drops it.
const SETTLE_MS = 3000;

export default function LifelineFeed({
  captures,
  activeFilter,
  onSelectCapture,
  onOpenInvite,
}: {
  captures: Capture[];
  activeFilter: string;
  onSelectCapture: (id: number, options?: { edit?: boolean }) => void;
  // Shared-Space invite trigger v1 - passed straight through to
  // LifelineDropCard, which only actually uses it for a Drop whose
  // primary Space the viewer owns.
  onOpenInvite: (spaceId: string) => void;
}) {
  const { updateStatus, hideCapture, archiveCapture, undoCaptureState } = useCaptures();
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  // Archived is checked first and short-circuits every other branch (tucked
  // away everywhere except its own Space) except the Archived filter
  // itself. isHiddenNow only ever gates the literal "all" Lifeline view -
  // a hidden Drop stays fully visible in its own Space, and in the
  // Completed/Pinned cross-cutting views, per spec. isHiddenNow itself is
  // two independent things ORed together: a manual hide (hiddenUntil is
  // now just a presence marker, not an expiry to compare against "now" -
  // Hide v2 has no duration) and a computed auto-hide for dated Drops more
  // than a week out (see isAutoHidden in autoHide.ts - purely derived,
  // nothing stored for this half).
  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      if (pendingRemovalIds.has(capture.id)) return true;

      // Daily Brief v1 relocated to the Me screen (see
      // app/(dashboard)/me/page.tsx) - system Drops no longer have any
      // presence on the Lifeline at all, not even indirectly. Excluded
      // here (not just at render time) so the empty-state message below
      // still reflects "any real Drops in this view", not just "any rows
      // at all" - a user with zero real Drops but a Daily Brief must
      // still see "No Drops yet.", not a blank space with no explanation.
      if (capture.source === "system") return false;

      const isArchived = capture.userArchivedAt !== null;
      if (activeFilter === "archived") return isArchived;
      if (isArchived) return false;

      if (activeFilter === "completed") return capture.status === "completed";
      if (activeFilter === "pinned") return capture.pinned === true;

      const isManuallyHidden = capture.hiddenUntil !== null;
      const isHiddenNow = isManuallyHidden || isAutoHidden(capture);
      if (activeFilter === "hidden") return isHiddenNow;
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

  async function handleToggleHide(id: number) {
    holdThroughSettle(id);
    await hideCapture(id);
  }

  async function handleArchive(id: number) {
    holdThroughSettle(id);
    await archiveCapture(id);
  }

  async function handleUndo(id: number) {
    holdThroughSettle(id);
    await undoCaptureState(id);
  }

  function renderCard(capture: Capture) {
    return (
      <LifelineDropCard
        key={capture.id}
        capture={capture}
        onSelect={onSelectCapture}
        onToggleStatus={() => handleToggleStatus(capture.id, capture.status)}
        onToggleHide={() => handleToggleHide(capture.id)}
        onArchive={() => handleArchive(capture.id)}
        onUndo={() => handleUndo(capture.id)}
        onOpenInvite={onOpenInvite}
      />
    );
  }

  function renderGroup({ key, members }: { key: string; members: Capture[] }) {
    return members.length > 1 ? (
      <DropGroupCarousel key={key} slides={members.map((member) => renderCard(member))} />
    ) : (
      renderCard(members[0])
    );
  }

  const groupedItems = useMemo(
    () => groupCapturesByGroupId(filteredCaptures),
    [filteredCaptures]
  );

  return (
    <div className="space-y-3">
      {/* Reminders is a synthetic card, not a capture in this list - kept
          out of the "no Drops yet" empty-state decision entirely. Only
          shown on the literal "all" Lifeline view - a per-Space or
          Completed/Archived/Pinned view has no "upcoming" framing that
          makes sense. */}
      {activeFilter === "all" && <RemindersCard onSelectCapture={onSelectCapture} />}

      {filteredCaptures.length === 0 ? (
        <p className="text-ink-dim text-center mt-6">
          {activeFilter === "completed"
            ? "No completed Drops yet."
            : activeFilter === "archived"
              ? "No archived Drops yet."
              : activeFilter === "hidden"
                ? "No hidden Drops."
                : activeFilter === "all"
                  ? "No Drops yet."
                  : "No Drops in this Space yet."}
        </p>
      ) : (
        groupedItems.map(renderGroup)
      )}
    </div>
  );
}
