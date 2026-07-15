"use client";

import { useState } from "react";

// Same inline text-input shape as SpacesPage's own rename control
// (SpaceTile's editing view) - a plain text field plus Save/Cancel, no
// modal - reused here rather than introducing a second lightweight-input
// pattern for what's the same kind of one-field action.
export default function CreateSpaceInline({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      console.error(err);
      setError("Couldn't create. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-2xl p-3">
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        autoFocus
        className="flex-1 min-w-[140px] text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="text-xs font-semibold bg-white text-gray-700 px-3 py-1.5 rounded-full ring-1 ring-gray-200 disabled:opacity-60"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}
