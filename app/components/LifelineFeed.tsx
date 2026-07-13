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
  const { updateStatus } = useCaptures();
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      if (pendingRemovalIds.has(capture.id)) return true;

      if (activeFilter === "completed") return capture.status === "completed";
      if (activeFilter === "pinned") return capture.pinned === true;
      if (capture.status === "completed") return false;

      return activeFilter === "all" || capture.spaceIds?.includes(activeFilter);
    });
  }, [captures, activeFilter, pendingRemovalIds]);

  async function handleToggleStatus(id: number, currentStatus: Capture["status"]) {
    const nextStatus = currentStatus === "completed" ? "active" : "completed";

    // Whichever direction, this item is about to leave the currently visible
    // filtered view - hold it visible through its own settle animation first.
    setPendingRemovalIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setPendingRemovalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, SETTLE_MS);

    await updateStatus(id, nextStatus);
  }

  if (filteredCaptures.length === 0) {
    return (
      <p className="text-gray-500 text-center mt-6">
        {activeFilter === "completed"
          ? "No completed Drops yet."
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
        />
      ))}
    </div>
  );
}
