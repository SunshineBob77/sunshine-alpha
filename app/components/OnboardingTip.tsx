"use client";

import { useEffect, useState } from "react";
import { useCaptures } from "@/app/lib/DashboardContext";

// Home screen v1 - a single fixed tip, not a rotating/sequential series
// (no content source for multiple tips was specified - flagging that as
// a follow-up if a richer tip system is wanted later). Dismiss state is
// localStorage, not a new captures/user_preferences column - this is
// pure client-side UI state with no need to sync across devices, and
// there's no existing precedent in this app for a lightweight "dismissed
// forever" flag like this (the one other client-storage usage,
// PENDING_JOIN_TOKEN_KEY in (dashboard)/layout.tsx, is a one-shot
// sessionStorage flow, not a persistent preference). Keyed per-user so
// one dismissal can't silently suppress the tip for a different account
// on a shared device/browser profile.
const TIP_TEXT = "Tap the 📌 icon on any Drop to pin it to the top of its Space.";

export default function OnboardingTip() {
  const { user } = useCaptures();
  const storageKey = `sunshine-onboarding-tip-dismissed-${user.id}`;
  // Defaults to dismissed until the effect below checks localStorage, so
  // there's no flash of the tip on every load before the check resolves.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Deferred into a callback rather than called synchronously in the
    // effect body - same "only touch state from an async/event callback,
    // never inline in the effect's own top-level flow" convention already
    // used elsewhere in this app (e.g. DashboardContext's stuck-analysis
    // retry sweep) to satisfy react-hooks/set-state-in-effect.
    const timeoutId = setTimeout(() => {
      setDismissed(localStorage.getItem(storageKey) === "1");
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [storageKey]);

  function handleDismiss() {
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl bg-gold/15 ring-1 ring-gold/20 px-4 py-3">
      <p className="text-sm text-ink">💡 {TIP_TEXT}</p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-sm font-semibold text-gold hover:text-peach"
      >
        Got it
      </button>
    </section>
  );
}
