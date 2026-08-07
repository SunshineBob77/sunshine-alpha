"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/app/lib/useAuthUser";
import AuthForm from "@/app/components/AuthForm";
import { DashboardProvider } from "@/app/lib/DashboardContext";
import { ThemeProvider } from "@/app/lib/ThemeContext";
import DashboardHeader from "@/app/components/DashboardHeader";
import BottomNav from "@/app/components/BottomNav";

// Must match AuthForm.tsx's own PENDING_JOIN_TOKEN_KEY constant - not
// imported from there since AuthForm is a leaf UI component, not a
// shared-constants module; duplicating one string literal here is
// simpler than adding a new shared file for it.
const PENDING_JOIN_TOKEN_KEY = "sunshine_pending_join_token";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const router = useRouter();

  // Recovers the join-invite handoff for the one case AuthForm's own
  // immediate-session redirect can't handle: a signup that required email
  // confirmation, where the eventual session shows up later - either via
  // logging in on a page that has nothing to do with the invite, or via
  // clicking the emailed confirmation link (which signs the user in and
  // lands them somewhere under this same dashboard layout, since / is
  // itself inside app/(dashboard)). Every ordinary session (the
  // overwhelming majority) has no pending token in sessionStorage at all,
  // so this is a no-op for them - it only ever fires the one time a
  // join-driven signup is actually waiting on confirmation.
  useEffect(() => {
    if (loading || !user) return;

    const pendingToken = sessionStorage.getItem(PENDING_JOIN_TOKEN_KEY);
    if (!pendingToken) return;

    sessionStorage.removeItem(PENDING_JOIN_TOKEN_KEY);
    router.push(`/join/${pendingToken}?justAuthed=1`);
  }, [loading, user, router]);

  if (loading) {
    // No user yet, so no profile theme_preference to read - falls back
    // to the plain bg-night token, which resolves dark by default (see
    // globals.css's :root values) same as everywhere else pre-theme-load.
    return <main className="min-h-dvh bg-night" />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <ThemeProvider user={user}>
      <DashboardProvider user={user}>
        <DashboardHeader />
        {/* No longer `relative z-0` - that combination (a positioned
            element with an explicit, non-auto z-index) creates its own
            stacking context, which trapped every descendant - including
            DropDetailModal's fixed z-50 full-screen root, no matter how
            deeply nested - into being compared against DashboardHeader
            (z-30) and BottomNav (z-40) as a single unit ranked at this
            div's own z-index (0), not whatever z-index a descendant sets.
            That's what let both nav bars visually/interactively win over
            the expanded Drop detail view wherever they overlapped it
            (its own header and footer), even though the modal's z-50
            should have been higher - confirmed live by reproducing and
            fixing this exact symptom before landing this change. */}
        <div className="min-h-dvh bg-night pt-14 pb-28">{children}</div>
        <BottomNav />
      </DashboardProvider>
    </ThemeProvider>
  );
}
