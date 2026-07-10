"use client";

import { useMemo, useState } from "react";
import LifelineDropCard from "./LifelineDropCard";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";

const COMPLETE_ANIMATION_MS = 1200;

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
      const matchesSpace = activeFilter === "all" || capture.spaceIds?.includes(activeFilter);
      if (!matchesSpace) return false;
      if (capture.status !== "completed") return true;
      return pendingRemovalIds.has(capture.id);
    });
  }, [captures, activeFilter, pendingRemovalIds]);

  async function handleToggleStatus(id: number, currentStatus: Capture["status"]) {
    const nextStatus = currentStatus === "completed" ? "active" : "completed";

    if (nextStatus === "completed") {
      setPendingRemovalIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setPendingRemovalIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, COMPLETE_ANIMATION_MS);
    }

    await updateStatus(id, nextStatus);
  }

  if (filteredCaptures.length === 0) {
    return (
      <p className="text-gray-500 text-center mt-6">
        {activeFilter === "all" ? "No Drops yet." : "No Drops in this Space yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
