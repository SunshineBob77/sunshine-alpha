import type { Capture } from "./captures";

// v1: plain client-side keyword matching over captures already loaded
// into DashboardContext - no new query, no new AI call. RLS is already
// fully enforced at the original fetchCaptures() load (owner-only plus
// Shared Spaces membership, same as everywhere else in the app), so
// filtering this same in-memory array can't leak anything a server-side
// query wouldn't have already excluded. Deliberately not a DB-side
// ilike/tsvector query: this app's realistic scale (a personal/small-
// shared-group dataset, already loaded wholesale on every session, same
// assumption used elsewhere in this codebase) makes "filter what's
// already in memory" both simpler and faster than a network round trip
// per keystroke - a real full-text search index is the natural upgrade
// path once/if that assumption stops holding, not needed now.
//
// Query is split into whitespace tokens; a capture matches only if EVERY
// token appears as a substring somewhere in its combined searchable
// text (order-independent, no phrase matching, no ranking) - simple
// enough to reason about, forgiving enough that typing a few relevant
// words still finds the right Drop even if they're not adjacent in the
// original text.
//
// Deliberately does NOT filter on status/hiddenUntil/userArchivedAt -
// Hidden, Completed, and Archived Drops must all remain fully
// searchable (Hide-for-now's own design principle, and the original
// Hide/Archive/Undo plan's explicit "still fully reachable via search").
// The one exclusion is source === "system" (Morning Brief, etc.) - those
// aren't really "Drops" a user is searching their own notes for.
export function searchCaptures(captures: Capture[], query: string): Capture[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return captures.filter((capture) => {
    if (capture.source === "system") return false;

    const blob = [
      capture.text,
      capture.title,
      capture.category,
      capture.project,
      capture.tags?.join(" "),
      capture.sunshineSummary,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => blob.includes(token));
  });
}
