"use client";

import { useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";

// variant: "light" (default) is the existing, unchanged appearance - used
// by DropDetailModal, which doesn't pass this prop. "dark" is scoped to
// the Lifeline feed screen's restyle only.
export default function DeleteDropButton({
  captureId,
  onDeleted,
  variant = "light",
  size = "sm",
}: {
  captureId: number;
  onDeleted?: () => void;
  variant?: "light" | "dark";
  // Expanded Drop detail view v1 - "lg" (~1.5x) is scoped to
  // DropDetailModal's own toolbar, which sized every other button up at
  // the same time. LifelineDropCard's "More" panel on the compact card
  // doesn't pass this, so it keeps its original size unchanged.
  size?: "sm" | "lg";
}) {
  const { removeCapture } = useCaptures();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = variant === "dark";
  const isLarge = size === "lg";

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      await removeCapture(captureId);
      onDeleted?.();
    } catch (err) {
      console.error(err);
      setError("Couldn't delete. Try again.");
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex flex-col items-start gap-1.5">
        <p className={`${isLarge ? "text-sm" : "text-xs"} ${isDark ? "text-ink-dim" : "text-gray-600"}`}>
          Delete this Drop? This can&apos;t be undone.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`${isLarge ? "text-lg px-4 py-2" : "text-xs px-3 py-1.5"} font-semibold rounded-full transition-all disabled:opacity-60 ${
              isDark
                ? "bg-red-500/90 hover:bg-red-500 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className={`${isLarge ? "text-lg px-4 py-2" : "text-xs px-3 py-1.5"} font-semibold rounded-full transition-all disabled:opacity-60 ${
              isDark
                ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className={`${isLarge ? "text-sm" : "text-xs"} ${isDark ? "text-red-400" : "text-red-600"}`}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete Drop"
      className={`${isLarge ? "text-lg px-4 py-2" : "text-xs px-2 py-1.5"} font-semibold rounded-full transition-all ${
        isDark
          ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      }`}
    >
      {isLarge ? "🗑️ Delete" : "🗑️"}
    </button>
  );
}
