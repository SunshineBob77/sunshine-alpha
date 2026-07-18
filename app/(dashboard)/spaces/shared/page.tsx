"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMySpaces, createSharedSpace, type MySpace } from "@/app/lib/sharedSpaces";
import InlineTextInput from "@/app/components/InlineTextInput";
import InviteSpaceModal from "@/app/components/InviteSpaceModal";

export default function SharedSpacesPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<MySpace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviteSpaceId, setInviteSpaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMySpaces()
      .then((data) => {
        if (!cancelled) setSpaces(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Couldn't load your shared spaces.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(name: string) {
    const space = await createSharedSpace(name);
    setCreating(false);
    setSpaces((prev) => (prev ? [...prev, space] : [space]));
  }

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => router.push("/spaces")}
            aria-label="Back to Spaces"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Shared Spaces</h1>
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="mb-4">
          {creating ? (
            <InlineTextInput
              placeholder="Shared Space name"
              onSubmit={handleCreate}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl transition-all"
            >
              + Create Shared Space
            </button>
          )}
        </div>
        {spaces === null ? (
          <p className="text-gray-500">Loading…</p>
        ) : spaces.length === 0 ? (
          <p className="text-gray-500">No shared spaces yet.</p>
        ) : (
          <div className="space-y-2">
            {spaces.map((space) => (
              <div
                key={space.id}
                className="w-full flex items-center gap-3 bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 hover:ring-amber-300 transition-all"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/?space=${space.id}`)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className="text-2xl shrink-0">{space.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{space.name}</p>
                    <p className="text-xs text-gray-500">
                      {space.role === "owner" ? "You own this" : "Member"}
                    </p>
                  </div>
                </button>
                {space.role === "owner" && (
                  <button
                    type="button"
                    onClick={() => setInviteSpaceId(space.id)}
                    className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition-all"
                  >
                    Invite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteSpaceModal spaceId={inviteSpaceId} onClose={() => setInviteSpaceId(null)} />
    </main>
  );
}
