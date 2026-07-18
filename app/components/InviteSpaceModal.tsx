"use client";

import { useEffect, useState } from "react";
import { createInviteLink } from "@/app/lib/sharedSpaces";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sunshine-alpha-nu.vercel.app";

// Extracted from app/(dashboard)/spaces/shared/page.tsx, which originally
// owned this modal's state/JSX inline - now a real shared component so
// the Lifeline feed's Shared-Space eyebrow badge can open the exact same
// invite flow directly from a collapsed DropCard, without navigating to
// the Shared Spaces list first.
export default function InviteSpaceModal({
  // null = closed. Owner-only in practice - createInviteLink's own RLS
  // policy (invite_links INSERT, is_space_owner-gated) is the real
  // boundary here, not this component. Every caller is expected to only
  // ever set a real value for a Space the current user actually owns
  // (see spaces/shared/page.tsx's role check, and LifelineDropCard's own
  // onInvite gating) - if a non-owner somehow reached this anyway, the
  // RLS rejection just surfaces as the error state below, same as any
  // other unauthorized write in this app.
  spaceId,
  onClose,
}: {
  spaceId: string | null;
  onClose: () => void;
}) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!spaceId) return;

    let cancelled = false;
    setInviteLink(null);
    setError(null);
    setCopied(false);
    setLoading(true);

    createInviteLink(spaceId)
      .then(({ token }) => {
        if (!cancelled) setInviteLink(`${APP_URL}/join/${token}`);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Couldn't create an invite link. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch (err) {
      console.error(err);
    }
  }

  if (!spaceId) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-3">Invite to this Space</h2>
        {loading && <p className="text-gray-500 text-sm">Creating link…</p>}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
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
          onClick={onClose}
          className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
