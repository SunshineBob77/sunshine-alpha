// Ask Sunshine v3 - AI escalation for the plain-search lane, fired only
// when v1's keyword search (searchCaptures.ts) finds zero results for a
// query that has real search terms (see shouldEscalateSearch in
// searchEscalation.ts - the single gate both the client's decision to
// call this route, and this route's own response shape, are built
// around, same discipline as resolveTemporal.ts's shouldEscalateToAi/
// resolveTemporal pairing).
//
// Sibling to v1's search, not a wrapper around v2's aggregation lane
// (ask-sunshine-v2/route.ts) - the two compose independently in
// ask/page.tsx, same as isAggregation/workoutIntent/results already do.
//
// Candidates are sent by the client rather than re-fetched here: the
// client already loaded every Drop it's allowed to see via
// DashboardContext's fetchCaptures() (RLS-scoped), so there is nothing
// this route could learn from a fresh Supabase query that the client
// doesn't already have - same "filter what's already in memory" posture
// searchCaptures.ts's own header comment documents for v1. This route's
// only job is turning (query, lightweight candidate list) into a
// relevance judgment call, which needs an AI, not a DB round trip.
//
// TODO(auth): trusts caller-supplied candidates/query, no session
// validation - same posture as analyze-drop, daily-brief, and
// ask-sunshine-v2.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SearchCandidate } from "@/app/lib/searchEscalation";

const anthropic = new Anthropic();

// Precision over recall, deliberately: this is a search feature, not a
// brainstorming or "related notes" feature, so a wrong/loosely-related
// result actively misleads the user about what they actually have
// captured, while an empty array just means "keep whatever the plain
// keyword search already showed" (usually its own "no Drops match"
// state) - a false positive costs more than a false negative here. Bias
// the model hard toward that asymmetry rather than leaving it to
// default toward the more common "be maximally helpful, return
// something" instinct.
function buildPrompt(query: string, candidates: SearchCandidate[]): string {
  return `A user searched their personal notes app ("Drops") for: "${query}"

Plain keyword search already found zero matches - none of these Drops contain the query's literal words. Below is a JSON list of their Drops (id, title, summary, category, project, tags - not the full note content). Decide which Drops, if any, are genuinely relevant to what the user is actually asking for, based on real meaning and intent rather than literal word overlap.

Be strict, not generous. Only include a Drop if a person reading the query and that Drop side by side would clearly recognize the Drop as answering it - not merely related, adjacent, or in the same general topic area. A shared theme, category, or vague thematic echo is NOT enough on its own. In particular, two Drops being in the same category (e.g. both "recipes", both "travel") does NOT make one relevant to a query about the other - a recipe for one dish is not relevant to a query about a different, unrelated dish just because both are recipes.

An empty array is a normal, correct, and common answer - it means none of these Drops genuinely match, which is expected most of the time. Returning an empty array is NOT a failure to avoid; guessing at a loosely-related Drop just to return something is the actual mistake. When in doubt, leave a Drop out.

Drops:
${JSON.stringify(candidates)}

Respond with exactly a JSON array of the relevant Drop ids, ordered most-relevant first, and nothing else before or after it - e.g. [12, 47]. If none are genuinely relevant - including if that means all of them - respond with [].`;
}

function parseRelevantIds(rawText: string, validIds: Set<number>): number[] {
  const parsed = JSON.parse(rawText.trim());
  if (!Array.isArray(parsed)) throw new Error("Response was not a JSON array");

  return parsed.filter((value): value is number => typeof value === "number" && validIds.has(value));
}

export async function POST(request: Request) {
  const body = await request.json();
  const { query, candidates } = body as { query?: string; candidates?: SearchCandidate[] };

  if (!query || !Array.isArray(candidates)) {
    return NextResponse.json({ error: "Missing query or candidates" }, { status: 400 });
  }

  // Nothing to match against - a real "zero results" answer, not a
  // failure, so this returns the same 200 shape as a genuine
  // no-relevant-Drops judgment from the AI would (see the try block
  // below), just without paying for a call that can't find anything.
  if (candidates.length === 0) {
    return NextResponse.json({ relevantIds: [] });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 512,
      messages: [{ role: "user", content: buildPrompt(query, candidates) }],
    });

    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const validIds = new Set(candidates.map((candidate) => candidate.id));
    const relevantIds = parseRelevantIds(rawText, validIds);

    return NextResponse.json({ relevantIds });
  } catch (error) {
    // Covers both a failed/timed-out API call and a malformed
    // (non-JSON-array) model response - either way, the client's own
    // catch swallows this into the same "no escalated results" state a
    // real zero-relevance judgment would produce, same silent-fallback
    // posture as ask-sunshine-v2.
    console.error("ask-sunshine-search escalation failed", error);
    return NextResponse.json({ error: "Search escalation failed" }, { status: 500 });
  }
}
