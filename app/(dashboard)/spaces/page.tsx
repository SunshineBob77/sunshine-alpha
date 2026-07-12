"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignableSpaces, defaultSpaces, type Space } from "@/app/lib/spaces";
import { orderSpaces } from "@/app/lib/spaceOrdering";
import { useCaptures } from "@/app/lib/DashboardContext";

// Rename affordance for one non-system tile - a small inline text input,
// not a separate modal, since the tile itself has room and this avoids
// yet another overlay for a one-field edit.
function SpaceTile({ space, displayName }: { space: Space; displayName: string }) {
  const { renameSpace } = useCaptures();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === displayName) {
      setEditing(false);
      setDraft(displayName);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await renameSpace(space.id, trimmed);
      setEditing(false);
    } catch (err) {
      console.error(err);
      setError("Couldn't rename. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className={`relative ${space.color} rounded-2xl p-3 text-center ring-2 ring-amber-400 shadow-md`}>
        <div className="text-2xl">{space.icon}</div>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          className="w-full mt-1 text-center text-sm font-semibold text-gray-900 bg-white/70 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex items-center justify-center gap-1.5 mt-1.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-[10px] font-semibold bg-gray-900 text-white px-2 py-1 rounded-full disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(displayName);
              setError(null);
            }}
            disabled={saving}
            className="text-[10px] font-semibold bg-white/70 text-gray-700 px-2 py-1 rounded-full disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push(`/?space=${space.id}`)}
      className={`relative ${space.color} rounded-2xl p-3 text-center ring-1 ring-black/5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all`}
    >
      {space.isSystem ? (
        <span
          className="absolute top-1.5 right-1.5 text-[10px] leading-none"
          title="System Space - not renamable or deletable"
        >
          🔒
        </span>
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              event.preventDefault();
              setEditing(true);
            }
          }}
          aria-label={`Rename ${displayName}`}
          className="absolute top-1.5 right-1.5 text-[10px] leading-none opacity-60 hover:opacity-100"
        >
          ✏️
        </span>
      )}
      <div className="text-2xl">{space.icon}</div>
      <div className="font-semibold text-gray-900 truncate">{displayName}</div>
      {space.isShared && <div className="text-xs mt-1 text-gray-600">Shared</div>}
    </button>
  );
}

export default function SpacesPage() {
  const { captures, openCapture, spaceOverrides } = useCaptures();

  const orderedSpaces = useMemo(
    () => orderSpaces(assignableSpaces, captures),
    [captures]
  );
  const systemSpaces = useMemo(() => defaultSpaces.filter((space) => space.isSystem), []);

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">
          Spaces
        </h1>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Organize</h2>

            <button
              onClick={openCapture}
              className="bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 px-5 rounded-xl shadow-sm transition-all"
            >
              + Capture
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Tap a Space to view its Drops on the Lifeline. Pinned-content Spaces sort first, then
            by recent activity.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...orderedSpaces, ...systemSpaces].map((space) => (
              <SpaceTile key={space.id} space={space} displayName={spaceOverrides[space.id] ?? space.name} />
            ))}
          </div>
        </section>

        <section className="mt-6 bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-lg text-gray-800 font-semibold mb-2">
            Shared calendars are coming soon.
          </p>
          <p className="text-gray-500">
            Soon you&apos;ll be able to share a calendar with family - Business/ADG, household
            errands, and more - all in one place.
          </p>
        </section>
      </div>
    </main>
  );
}
