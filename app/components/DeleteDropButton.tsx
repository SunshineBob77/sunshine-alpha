"use client";

import { useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";

export default function DeleteDropButton({ captureId }: { captureId: number }) {
  const { removeCapture } = useCaptures();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      await removeCapture(captureId);
    } catch (err) {
      console.error(err);
      setError("Couldn't delete. Try again.");
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex flex-col items-start gap-1.5">
        <p className="text-xs text-gray-600">Delete this Drop? This can't be undone.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete Drop"
      className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-all"
    >
      🗑️
    </button>
  );
}
