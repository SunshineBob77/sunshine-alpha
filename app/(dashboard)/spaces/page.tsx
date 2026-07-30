"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignableSpaces, defaultSpaces, type Space } from "@/app/lib/spaces";
import { orderSpaces } from "@/app/lib/spaceOrdering";
import { useCaptures } from "@/app/lib/DashboardContext";
import { useTheme } from "@/app/lib/ThemeContext";
import { getSpaceColor } from "@/app/lib/spaceColors";
import { createSharedSpace } from "@/app/lib/sharedSpaces";
import InlineTextInput from "@/app/components/InlineTextInput";
import SharedSpacesTile from "@/app/components/SharedSpacesTile";

// Rename affordance for one non-system tile - a small inline text input,
// not a separate modal, since the tile itself has room and this avoids
// yet another overlay for a one-field edit.
function SpaceTile({ space, displayName }: { space: Space; displayName: string }) {
  const { renameSpace } = useCaptures();
  const router = useRouter();
  const { theme } = useTheme();
  // Unified theme system v1 - a Space's own light-mode fill tint is a
  // whole-tile-sized surface (unlike DropCard's small circular icon
  // badge, which keeps showing its fill tint as a decorative accent in
  // both themes, pre-dating this change) - per the design spec, dark
  // mode has no separate fill, it uses the plain card token instead.
  const tileBackground = theme === "dark" ? "var(--color-dusk)" : getSpaceColor(space.id).fill;
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
      <div
        className="relative rounded-2xl p-3 text-center ring-2 ring-amber-400 shadow-md"
        style={{ backgroundColor: tileBackground }}
      >
        <div className="text-2xl">{space.icon}</div>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          className="w-full mt-1 text-center text-sm font-semibold text-ink bg-dusk/70 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
            className="text-[10px] font-semibold bg-dusk/70 text-ink-dim px-2 py-1 rounded-full disabled:opacity-60"
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
      className="relative rounded-2xl p-3 text-center ring-1 ring-black/5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all"
      style={{ backgroundColor: tileBackground }}
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
      <div className="font-semibold text-ink truncate">{displayName}</div>
      {space.isShared && <div className="text-xs mt-1 text-ink-dim">Shared</div>}
    </button>
  );
}

export default function SpacesPage() {
  const { captures, spaceOverrides } = useCaptures();
  const router = useRouter();
  const [creatingShared, setCreatingShared] = useState(false);

  const orderedSpaces = useMemo(
    () => orderSpaces(assignableSpaces, captures),
    [captures]
  );
  const systemSpaces = useMemo(() => defaultSpaces.filter((space) => space.isSystem), []);

  async function handleCreateShared(name: string) {
    await createSharedSpace(name);
    // The sub-list page does its own fresh fetchMySpaces() - simplest way
    // to "immediately reflect" the new space without duplicating list
    // state on this tab too, which otherwise never shows individual
    // shared spaces at all (only the folder tile).
    router.push("/spaces/shared");
  }

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <section className="bg-dusk rounded-3xl ring-1 ring-ink/10 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              type="button"
              disabled
              title="Creating additional personal Spaces isn't built yet"
              className="text-sm font-semibold bg-ink/5 text-ink-dim px-4 py-2 rounded-xl cursor-not-allowed"
            >
              + Create Space
            </button>

            {creatingShared ? (
              <InlineTextInput
                placeholder="Shared Space name"
                onSubmit={handleCreateShared}
                onCancel={() => setCreatingShared(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingShared(true)}
                className="text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl transition-all"
              >
                + Create Shared Space
              </button>
            )}
          </div>

          <p className="text-sm text-ink-dim mb-4">
            Tap a Space to view its Drops on the Lifeline. Pinned-content Spaces sort first, then
            by recent activity.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...orderedSpaces, ...systemSpaces].map((space) =>
              space.id === "shared" ? (
                <SharedSpacesTile key={space.id} space={space} />
              ) : (
                <SpaceTile
                  key={space.id}
                  space={space}
                  displayName={spaceOverrides[space.id] ?? space.name}
                />
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
