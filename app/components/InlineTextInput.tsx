"use client";

import { useState } from "react";

// Generic single-field text input with Save/Cancel - same shape as
// SpacesPage's own rename control (SpaceTile's editing view). Originally
// built just for "create a Space" (hence prior name), reused as-is for
// any other lightweight one-field action (e.g. adding a Drop attachment)
// rather than duplicating this pattern under a second name.
export default function InlineTextInput({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (value: string) => Promise<void>;
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
      setError("Couldn't save. Try again.");
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
