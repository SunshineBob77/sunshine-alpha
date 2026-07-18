"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/app/lib/useAuthUser";
import AuthForm from "@/app/components/AuthForm";
import { DashboardProvider } from "@/app/lib/DashboardContext";
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
    return (
      <main className="min-h-dvh bg-gradient-to-b from-amber-50 via-orange-50/50 to-white" />
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <DashboardProvider user={user}>
      <DashboardHeader />
      <div className="relative z-0 min-h-dvh bg-gradient-to-b from-amber-50 via-orange-50/50 to-white pt-14 pb-28">
        {children}
      </div>
      <BottomNav />
    </DashboardProvider>
  );
}
