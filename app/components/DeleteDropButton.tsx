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
}: {
  captureId: number;
  onDeleted?: () => void;
  variant?: "light" | "dark";
}) {
  const { removeCapture } = useCaptures();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = variant === "dark";

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
        <p className={`text-xs ${isDark ? "text-ink-dim" : "text-gray-600"}`}>
          Delete this Drop? This can&apos;t be undone.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-60 ${
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
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-60 ${
              isDark
                ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className={`text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete Drop"
      className={`text-xs font-semibold px-2 py-1.5 rounded-full transition-all ${
        isDark
          ? "bg-ink/5 hover:bg-ink/10 text-ink-dim"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      }`}
    >
      🗑️
    </button>
  );
}
