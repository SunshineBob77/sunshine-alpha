"use client";

import { useMemo, useState } from "react";
import LifelineDropCard from "./LifelineDropCard";
import { defaultSpaces } from "@/app/lib/spaces";
import type { Capture } from "@/app/lib/captures";

const filterOptions = [
  { id: "all", name: "All", icon: "🌞" },
  ...defaultSpaces.map((space) => ({ id: space.id, name: space.name, icon: space.icon })),
];

export default function LifelineFeed({
  captures,
  onSelectCapture,
}: {
  captures: Capture[];
  onSelectCapture: (id: number) => void;
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredCaptures = useMemo(() => {
    if (activeFilter === "all") return captures;
    return captures.filter((capture) => capture.spaceIds?.includes(activeFilter));
  }, [captures, activeFilter]);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setActiveFilter(option.id)}
            className={`shrink-0 whitespace-nowrap text-sm font-semibold px-3.5 py-2 rounded-full transition-all ${
              activeFilter === option.id
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 ring-1 ring-black/5 hover:ring-black/10"
            }`}
          >
            {option.icon} {option.name}
          </button>
        ))}
      </div>

      {filteredCaptures.length === 0 ? (
        <p className="text-gray-500 text-center mt-6">
          {activeFilter === "all" ? "No Drops yet." : "No Drops in this Space yet."}
        </p>
      ) : (
        <div className="space-y-4 mt-5">
          {filteredCaptures.map((capture) => (
            <LifelineDropCard key={capture.id} capture={capture} onSelect={onSelectCapture} />
          ))}
        </div>
      )}
    </div>
  );
}
