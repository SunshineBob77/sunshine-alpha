"use client";

import { useMemo } from "react";
import LifelineDropCard from "./LifelineDropCard";
import type { Capture } from "@/app/lib/captures";

export default function LifelineFeed({
  captures,
  activeFilter,
  onSelectCapture,
}: {
  captures: Capture[];
  activeFilter: string;
  onSelectCapture: (id: number) => void;
}) {
  const filteredCaptures = useMemo(() => {
    if (activeFilter === "all") return captures;
    return captures.filter((capture) => capture.spaceIds?.includes(activeFilter));
  }, [captures, activeFilter]);

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
        <LifelineDropCard key={capture.id} capture={capture} onSelect={onSelectCapture} />
      ))}
    </div>
  );
}
