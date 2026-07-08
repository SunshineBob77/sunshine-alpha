"use client";

import { useState } from "react";
import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import { defaultSpaces } from "@/app/lib/spaces";
import { useCaptures } from "@/app/lib/DashboardContext";
import type { Capture } from "@/app/lib/captures";

function SpacePicker({ capture }: { capture: Capture }) {
  const { updateSpaces } = useCaptures();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSpaces = defaultSpaces.filter((space) => capture.spaceIds?.includes(space.id));

  async function toggleSpace(spaceId: string) {
    const current = capture.spaceIds ?? [];
    const next = current.includes(spaceId)
      ? current.filter((id) => id !== spaceId)
      : [...current, spaceId];

    setPendingId(spaceId);
    setError(null);

    try {
      await updateSpaces(capture.id, next);
    } catch (err) {
      console.error(err);
      setError("Couldn't update. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {activeSpaces.map((space) => (
          <span key={space.id} className={`text-xs px-2 py-1 rounded-full ${space.color}`}>
            {space.icon} {space.name}
            {space.isShared ? " · Shared" : ""}
          </span>
        ))}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full transition-all"
        >
          {open ? "Done" : activeSpaces.length > 0 ? "Edit Spaces" : "+ Add to Space"}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap gap-2 p-3 bg-gray-50 rounded-2xl">
          {defaultSpaces.map((space) => {
            const active = capture.spaceIds?.includes(space.id);
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => toggleSpace(space.id)}
                disabled={pendingId === space.id}
                className={`text-xs px-2.5 py-1.5 rounded-full ring-1 transition-all disabled:opacity-50 ${
                  active
                    ? `${space.color} ring-black/10 font-semibold`
                    : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-300"
                }`}
              >
                {active ? "✓ " : ""}
                {space.icon} {space.name}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function DropDetailModal({
  capture,
  onClose,
}: {
  capture: Capture;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white p-6 rounded-3xl ring-1 ring-black/5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
            {capture.category}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <ShareButton capture={capture} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <SpacePicker capture={capture} />

        <p className="text-lg text-gray-900 break-words whitespace-pre-wrap">{capture.text}</p>

        <p className="text-sm text-gray-500 mt-3">
          {new Date(capture.createdAt).toLocaleString()}
        </p>

        {capture.aiResearchResult && (
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm bg-sky-100">
                🔎
              </span>
              <h3 className="font-semibold text-sm text-gray-900">Sunshine found this</h3>
            </div>
            <p className="text-sm text-gray-800 break-words">{capture.aiResearchResult}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <DeleteDropButton captureId={capture.id} onDeleted={onClose} />
          {capture.extractedAddress && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(capture.extractedAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full transition-all"
            >
              📍 Open in Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
