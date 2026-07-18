"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMySpaces,
  createSharedSpace,
  createInviteLink,
  type MySpace,
} from "@/app/lib/sharedSpaces";
import InlineTextInput from "@/app/components/InlineTextInput";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sunshine-alpha-nu.vercel.app";

export default function SharedSpacesPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<MySpace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [inviteSpaceId, setInviteSpaceId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMySpaces()
      .then((data) => {
        if (!cancelled) setSpaces(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Couldn't load
cat > "app/(dashboard)/spaces/shared/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMySpaces,
  createSharedSpace,
  createInviteLink,
  type MySpace,
} from "@/app/lib/sharedSpaces";
import InlineTextInput from "@/app/components/InlineTextInput";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sunshine-alpha-nu.vercel.app";

export default function SharedSpacesPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<MySpace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [inviteSpaceId, setInviteSpaceId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function handleInvite(spaceId: string) {
    setInviteSpaceId(spaceId);
    setInviteLink(null);
    setInviteError(null);
    setCopied(false);
    setInviteLoading(true);
    try {
      const { token } = await createInviteLink(spaceId);
      setInviteLink(`${APP_URL}/join/${token}`);
    } catch (err) {
      console.error(err);
      setInviteError("Couldn't create an invite link. Try again.");
    } finally {
      setInviteLoading(false);
    }
  }

  function closeInviteModal() {
    setInviteSpaceId(null);
    setInviteLink(null);
    setInviteError(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch (err) {
      console.error(err);
    }
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
                    onClick={() => handleInvite(space.id)}
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

      {inviteSpaceId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={closeInviteModal}
        >
          <div
            className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-3">Invite to this Space</h2>
            {inviteLoading && <p className="text-gray-500 text-sm">Creating link…</p>}
            {inviteError && <p className="text-red-600 text-sm mb-3">{inviteError}</p>}
            {inviteLink && (
              <>
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 break-all mb-3">
                  {inviteLink}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl transition-all mb-2"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <p className="text-xs text-gray-400">Expires in 30 days. Anyone with this link can join.</p>
              </>
            )}
            <button
              type="button"
              onClick={closeInviteModal}
              className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
