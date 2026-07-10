"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { defaultSpaces } from "@/app/lib/spaces";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";
import DropDetailModal from "@/app/components/DropDetailModal";
import LifelineDropCard from "@/app/components/LifelineDropCard";

const SETTLE_MS = 3000;

export default function SpacesPage() {
  const { captures, capturesLoading, openCapture, updateStatus } = useCaptures();
  const searchParams = useSearchParams();
  const requestedSpace = searchParams.get("space");
  const [activeSpace, setActiveSpace] = useState(
    requestedSpace && defaultSpaces.some((space) => space.id === requestedSpace)
      ? requestedSpace
      : "personal"
  );
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(null);
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<number>>(new Set());

  const activeSpaceObject = useMemo(() => {
    return defaultSpaces.find((space) => space.id === activeSpace) || defaultSpaces[0];
  }, [activeSpace]);

  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      if (pendingRemovalIds.has(capture.id)) return true;

      if (activeSpace === "completed") return capture.status === "completed";
      return capture.status !== "completed" && capture.spaceIds?.includes(activeSpace);
    });
  }, [captures, activeSpace, pendingRemovalIds]);

  async function handleToggleStatus(id: number, currentStatus: Capture["status"]) {
    const nextStatus = currentStatus === "completed" ? "active" : "completed";

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

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">
          Spaces
        </h1>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">All Spaces</h2>

            <button
              onClick={openCapture}
              className="bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 px-5 rounded-xl shadow-sm transition-all"
            >
              + Capture
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {defaultSpaces.map((space) => (
              <button
                key={space.id}
                onClick={() => setActiveSpace(space.id)}
                className={`relative ${space.color} rounded-2xl p-3 text-center ring-1 ring-black/5 transition-all ${
                  activeSpace === space.id
                    ? "ring-2 ring-amber-400 scale-[1.03] shadow-md"
                    : "shadow-sm hover:shadow-md hover:scale-[1.01]"
                }`}
              >
                {space.isSystem && (
                  <span
                    className="absolute top-1.5 right-1.5 text-[10px] leading-none"
                    title="System Space - not renamable or deletable"
                  >
                    🔒
                  </span>
                )}
                <div className="text-2xl">{space.icon}</div>
                <div className="font-semibold text-gray-900">{space.name}</div>
                {space.isShared && (
                  <div className="text-xs mt-1 text-gray-600">Shared</div>
                )}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Active Space: {activeSpaceObject.icon} {activeSpaceObject.name}
          </p>
        </section>

        <section className="mt-10 text-center w-full">
          <h2 className="text-2xl font-semibold mb-2 text-gray-900">
            {activeSpaceObject.icon} {activeSpaceObject.name} Vault
          </h2>

          {capturesLoading ? (
            <p className="text-gray-500">Loading captures…</p>
          ) : filteredCaptures.length === 0 ? (
            <p className="text-gray-500">No captures in this Space yet.</p>
          ) : (
            <div className="space-y-4 mt-4">
              {filteredCaptures.map((capture) => (
                <LifelineDropCard
                  key={capture.id}
                  capture={capture}
                  onSelect={setSelectedCaptureId}
                  onToggleStatus={() => handleToggleStatus(capture.id, capture.status)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedCapture && (
        <DropDetailModal
          capture={selectedCapture}
          onClose={() => setSelectedCaptureId(null)}
        />
      )}
    </main>
  );
}
