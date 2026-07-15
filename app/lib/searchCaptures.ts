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

// "Ask Sunshine" invites natural phrasing ("find X", "show me X", "how
// many X"), but the matching logic is still plain AND-across-tokens
// keyword search, not a rewrite into anything conversational - these
// carry no search meaning on their own and would otherwise become
// required tokens that silently zero out results a bare keyword would
// have found (e.g. "find ADG" requiring the literal word "find" to
// appear in a Drop, which it never does). Stripped before tokenizing
// rather than matched against. "how"/"many" are here specifically so
// "how many boxing" still surfaces plain keyword matches on "boxing" -
// counting/aggregating is separate, later work; this only stops the
// filler words from blocking the keyword search that already exists.
const FILLER_WORDS = new Set([
  "find",
  "show",
  "search",
  "what",
  "what's",
  "whats",
  "tell",
  "look",
  "get",
  "give",
  "me",
  "for",
  "up",
  "is",
  "how",
  "many",
]);

// Exported separately from searchCaptures so a caller (the Ask Sunshine
// page) can tell "no real search terms at all" (empty query, or every
// word typed was filler) apart from "real terms, zero Drops matched" -
// those need different empty-state messaging, not the same "no results".
export function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !FILLER_WORDS.has(token));
}

export function searchCaptures(captures: Capture[], query: string): Capture[] {
  const tokens = tokenizeSearchQuery(query);
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
