"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuthUser } from "@/app/lib/useAuthUser";
import { previewInvite, redeemInvite, type InvitePreview } from "@/app/lib/sharedSpaces";

// The Shared Spaces invite-link mechanism (createInviteLink/previewInvite/
// redeemInvite, app/lib/sharedSpaces.ts) had zero UI wired to it before
// this route - the RPCs it wraps (preview_invite/redeem_invite,
// docs/space-invite-links-schema.sql + docs/invite-rpc-fixes-schema.sql)
// were sound but genuinely unreachable. This is the missing acceptance
// page: whatever /join/<token> URL createInviteLink()'s token eventually
// gets shared as (it returns a bare token today, no URL - the caller
// picks the convention, and this route is that convention).
//
// Not scoped under app/(dashboard) on purpose - that layout's own auth
// gate (see (dashboard)/layout.tsx) would force a login/signup detour
// BEFORE this page ever got to show the space preview, which breaks the
// "see what you're joining before committing to an account" flow
// preview_invite was explicitly built to support (it grants EXECUTE to
// anon for exactly this reason). This route does its own auth check
// instead, via the same useAuthUser() hook the dashboard layout uses.

type PreviewState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "invite_status"; preview: InvitePreview }
  | { status: "error"; message: string };

type RedeemState =
  | { status: "idle" }
  | { status: "redeeming" }
  | { status: "done"; spaceId: string; spaceName: string; alreadyMember: boolean }
  | { status: "error"; message: string };

export default function JoinInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ justAuthed?: string }>;
}) {
  const { token } = use(params);
  // Set the instant the AuthForm handoff (see app/components/AuthForm.tsx)
  // redirects back here right after establishing a session for THIS
  // token - the signal that lets this page auto-redeem without a second
  // confirmation tap, since signing up via this exact link already was
  // the confirmation. Absent for anyone who lands here already logged in
  // from an unrelated session (e.g. a link forwarded to them, or one they
  // click days later) - see the logged-in branch below, which requires an
  // explicit "Join" tap instead. Read once - this page never needs to
  // re-check it after the initial auto-redeem attempt.
  const { justAuthed } = use(searchParams);
  const autoRedeem = justAuthed === "1";

  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [redeem, setRedeem] = useState<RedeemState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    previewInvite(token)
      .then((result) => {
        if (!cancelled) setPreview({ status: "invite_status", preview: result });
      })
      .catch((error) => {
        console.error("previewInvite failed", error);
        if (cancelled) return;
        // previewInvite() throws a specific "Invite link not found." for
        // zero rows (garbage/malformed/nonexistent token) - everything
        // else (network error, RLS surprise) falls back to a generic
        // message rather than misreporting it as "not found."
        if (error instanceof Error && error.message === "Invite link not found.") {
          setPreview({ status: "not_found" });
        } else {
          setPreview({ status: "error", message: "Couldn't load this invite. Try again." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleRedeem() {
    if (preview.status !== "invite_status") return;
    setRedeem({ status: "redeeming" });

    try {
      const result = await redeemInvite(token);
      setRedeem({
        status: "done",
        spaceId: result.spaceId,
        spaceName: preview.preview.spaceName,
        alreadyMember: result.alreadyMember,
      });
    } catch (error) {
      console.error("redeemInvite failed", error);
      setRedeem({
        status: "error",
        message: error instanceof Error ? error.message : "Couldn't join this space.",
      });
    }
  }

  // Auto-redeem exactly once, only right after the signup/login handoff
  // AuthForm sent us back here for - see the autoRedeem comment above.
  // Gated on redeem.status === "idle" (rather than a separate "have I
  // tried yet" flag) - handleRedeem's own first line synchronously flips
  // redeem to "redeeming", so this effect naturally won't fire a second
  // time once that happens, with no extra state to keep in sync.
  useEffect(() => {
    if (!autoRedeem) return;
    if (authLoading || !user) return;
    if (preview.status !== "invite_status") return;
    if (redeem.status !== "idle") return;

    handleRedeem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRedeem, authLoading, user, preview, redeem.status]);

  // Redirect into the joined Space's Lifeline view - same ?space= param
  // spaces/shared/page.tsx already uses for the identical "open this
  // space" action. A short pause first so the confirmation message is
  // actually readable, not an instant flash before navigating away.
  useEffect(() => {
    if (redeem.status !== "done") return;
    const timer = setTimeout(() => {
      router.push(`/?space=${redeem.spaceId}`);
    }, 1400);
    return () => clearTimeout(timer);
  }, [redeem, router]);

  function goToSignup() {
    router.push(`/?mode=signup&join=${token}`);
  }

  function goToLogin() {
    router.push(`/?mode=login&join=${token}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/sunshine-logo.png"
            alt="Sunshine"
            width={1276}
            height={358}
            className="h-9 w-auto"
            priority
          />
        </div>

        {(preview.status === "loading" || authLoading) && (
          <p className="text-gray-500">Loading invite…</p>
        )}

        {preview.status === "not_found" && (
          <>
            <p className="text-lg font-semibold text-gray-900 mb-2">Invite link not found</p>
            <p className="text-sm text-gray-500 mb-6">
              This link doesn&apos;t look right — double-check it and try again, or ask whoever
              shared it for a fresh one.
            </p>
            <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Go to Sunshine
            </Link>
          </>
        )}

        {preview.status === "error" && (
          <>
            <p className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</p>
            <p className="text-sm text-gray-500 mb-6">{preview.message}</p>
            <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Go to Sunshine
            </Link>
          </>
        )}

        {preview.status === "invite_status" && preview.preview.status !== "valid" && (
          <>
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {preview.preview.status === "expired" && "This invite has expired"}
              {preview.preview.status === "revoked" && "This invite has been revoked"}
              {preview.preview.status === "exhausted" && "This invite has already been used"}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {preview.preview.status === "expired" &&
                `Invite links to ${preview.preview.spaceName} expire after 30 days. Ask the space owner for a new one.`}
              {preview.preview.status === "revoked" &&
                `The owner of ${preview.preview.spaceName} turned off this link. Ask them for a new one.`}
              {preview.preview.status === "exhausted" &&
                `This link to ${preview.preview.spaceName} has reached its use limit. Ask the space owner for a new one.`}
            </p>
            <Link href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Go to Sunshine
            </Link>
          </>
        )}

        {preview.status === "invite_status" &&
          preview.preview.status === "valid" &&
          !authLoading && (
            <>
              <div className="flex justify-center mb-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-3xl">
                  {preview.preview.spaceIcon}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                You&apos;re invited to join
              </p>
              <p className="text-xl font-bold text-amber-700 mb-6">{preview.preview.spaceName}</p>

              {redeem.status === "idle" && !user && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={goToSignup}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 rounded-xl shadow-sm transition-all"
                  >
                    Create an account to join
                  </button>
                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full text-sm text-gray-500 hover:text-gray-700"
                  >
                    Already have a Sunshine account? Log in
                  </button>
                </div>
              )}

              {redeem.status === "idle" && user && !autoRedeem && (
                <button
                  type="button"
                  onClick={handleRedeem}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-3 rounded-xl shadow-sm transition-all"
                >
                  Join {preview.preview.spaceName}
                </button>
              )}

              {(redeem.status === "redeeming" ||
                (redeem.status === "idle" && user && autoRedeem)) && (
                <p className="text-gray-500">Joining…</p>
              )}

              {redeem.status === "done" && (
                <p className="text-sm font-semibold text-emerald-700">
                  {redeem.alreadyMember
                    ? `You're already in ${redeem.spaceName} — taking you there…`
                    : `Welcome to ${redeem.spaceName} ☀️ — taking you there…`}
                </p>
              )}

              {redeem.status === "error" && (
                <>
                  <p className="text-sm text-red-600 mb-4">{redeem.message}</p>
                  <button
                    type="button"
                    onClick={handleRedeem}
                    className="text-sm font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Try again
                  </button>
                </>
              )}
            </>
          )}
      </div>
    </main>
  );
}
