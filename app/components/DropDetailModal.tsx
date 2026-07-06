"use client";

import ShareButton from "./ShareButton";
import DeleteDropButton from "./DeleteDropButton";
import type { Capture } from "@/app/lib/captures";

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

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
          <ShareButton capture={capture} />
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
