// Pure logic for Ask Sunshine v3's search-escalation lane - no Supabase,
// no AI call, no UI. Mirrors resolveTemporal.ts's own split: a cheap
// local gate (shouldEscalateSearch) decides whether the AI needs to be
// asked at all, and a separate pure merge function (mergeEscalatedResults)
// turns whatever the AI comes back with into real Drops - both built
// around the same signal (zero local keyword results) so the two can
// never drift out of sync with each other, same discipline as
// shouldEscalateToAi/resolveTemporal's own pairing.
//
// Sibling to v1's searchCaptures.ts, not a wrapper around v2's
// aggregation lane (aggregationIntent.ts) - this only ever fires when
// searchCaptures() itself found zero results, entirely independent of
// whether a query also happens to be aggregation-shaped.

import type { Capture } from "./captures";

// True exactly when there were real search terms to look for (tokens
// survived filler-stripping) but plain keyword search still came back
// empty - the one and only trigger for this lane. Deliberately does NOT
// escalate on a low-but-nonzero result count; that's a different,
// out-of-scope question (v1's keyword results already found something,
// however few).
export function shouldEscalateSearch(tokens: string[], localResultCount: number): boolean {
  return tokens.length > 0 && localResultCount === 0;
}

export type SearchCandidate = {
  id: number;
  title: string | null;
  summary: string;
  category: string;
  project: string;
  tags: string[];
};

const SNIPPET_LENGTH = 160;

// analyzeCapture.ts's own fixed sunshineSummary strings - this field is
// never touched by the AI analyze-drop pass afterward (only
// title/category/etc. are, see analyze-drop/route.ts's updatePayload),
// so for a large share of real Drops it's permanently one of these four
// canned templates, not a real per-Drop summary. Treated the same as an
// empty/missing summary for escalation purposes. Deliberately duplicated
// here rather than imported from analyzeCapture.ts - matches this
// codebase's existing "small named term list, scope up later if it
// drifts" discipline (see WEEKDAY_NAMES's own two independent copies in
// resolveTemporal.ts).
const GENERIC_SUMMARY_TEMPLATES = new Set([
  "Captured a personal note.",
  "You made progress building software today. ☀️",
  "You captured something related to driving work.",
  "This sounds like something to remember or act on.",
]);

function snippet(text: string, maxLength: number): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}…` : trimmed;
}

// Falls back to a short leading snippet of the Drop's own text whenever
// sunshineSummary is missing or is one of the generic canned templates
// above - keeps the AI payload lightweight (a snippet, not full
// text/formattedText) while still giving Drops with no real summary some
// actual signal to be matched against, rather than sending a useless
// placeholder string.
function resolveCandidateSummary(capture: Capture): string {
  if (capture.sunshineSummary && !GENERIC_SUMMARY_TEMPLATES.has(capture.sunshineSummary)) {
    return capture.sunshineSummary;
  }
  return snippet(capture.text, SNIPPET_LENGTH);
}

// Excludes system Drops (Daily Brief, etc.), same as searchCaptures.ts -
// those aren't real Drops a user is searching their own notes for.
export function buildSearchCandidates(captures: Capture[]): SearchCandidate[] {
  return captures
    .filter((capture) => capture.source !== "system")
    .map((capture) => ({
      id: capture.id,
      title: capture.title?.trim() || null,
      summary: resolveCandidateSummary(capture),
      category: capture.category,
      project: capture.project,
      tags: capture.tags ?? [],
    }));
}

// Turns the AI's relevant-id list back into real Capture objects, in the
// order the AI returned them (most-relevant first, per the prompt) -
// ids that don't correspond to any currently-loaded Drop (a stale id, or
// anything the model hallucinated past what parseRelevantIds' own
// validIds check on the server already filtered) are silently dropped
// rather than surfaced as an error, same "safe failure mode" posture as
// the rest of this app's AI-adjacent parsing.
export function mergeEscalatedResults(captures: Capture[], relevantIds: number[]): Capture[] {
  const order = new Map(relevantIds.map((id, index) => [id, index]));
  return captures
    .filter((capture) => order.has(capture.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
