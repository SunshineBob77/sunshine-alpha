// Daily Brief "mini dashboard" pages (v2, added alongside the original
// Card 1 activity delta) - pure, synchronous stat computation over data
// already loaded into DashboardContext (captures, sharedSpaces). No new
// queries, no server generation, no storage - these are current-state
// totals, not a "since you were last here" delta the way Card 1 is, so
// there's nothing to freeze; they're just recomputed live whenever the
// carousel renders.
//
// Deliberately scoped to the viewing user's OWN captures only
// (capture.userId === userId), not every Drop they can see (which for a
// Shared Space also includes teammates' Drops, via RLS). This is a
// personal stats dashboard - "what does MY Sunshine look like right
// now" - not a space-wide activity report the way Card 1's cross-member
// delta is. Keeps every page on this carousel answering the same
// question, rather than mixing personal totals with teammates' volume on
// some pages and not others.
import type { Capture } from "./captures";
import type { MySpace } from "./sharedSpaces";
import { defaultSpaces } from "./spaces";

function ownCaptures(captures: Capture[], userId: string): Capture[] {
  return captures.filter((capture) => capture.userId === userId && capture.source === "user");
}

export type SpaceDropCount = {
  spaceId: string;
  spaceName: string;
  spaceIcon: string;
  count: number;
};

// A Drop can belong to more than one Space (space_ids is an array), so
// this counts every membership, not just the primary/first one - a Drop
// in both "Work" and a Shared Space contributes to both totals, same as
// how the Space picker itself treats multi-Space assignment as a real,
// independent membership in each.
export function computeSpaceDropCounts(
  captures: Capture[],
  userId: string,
  sharedSpaces: MySpace[]
): SpaceDropCount[] {
  const counts = new Map<string, number>();
  for (const capture of ownCaptures(captures, userId)) {
    for (const spaceId of capture.spaceIds ?? []) {
      counts.set(spaceId, (counts.get(spaceId) ?? 0) + 1);
    }
  }

  const personalById = new Map(defaultSpaces.filter((space) => !space.isSystem).map((space) => [space.id, space]));
  const sharedById = new Map(sharedSpaces.map((space) => [space.id, space]));

  const results: SpaceDropCount[] = [];
  for (const [spaceId, count] of counts) {
    const personal = personalById.get(spaceId);
    const shared = sharedById.get(spaceId);
    if (personal) {
      results.push({ spaceId, spaceName: personal.name, spaceIcon: personal.icon, count });
    } else if (shared) {
      results.push({ spaceId, spaceName: shared.name, spaceIcon: shared.icon, count });
    }
    // An unrecognized id (e.g. a stale reference to a since-deleted
    // Shared Space) is silently excluded here - nothing meaningful to
    // label it with, and unlike a single Drop card, a pure count list has
    // no "Unsorted" fallback slot that makes sense to show.
  }

  return results.sort((a, b) => b.count - a.count);
}

export type CategoryCount = {
  category: string;
  count: number;
};

// Fixed display order matching analyze-drop/route.ts's own CATEGORY
// task ("Achievement", "Task", "Work", or "Memory") - not alphabetical,
// not by count, so the order reads the same every time regardless of
// which category currently has the most Drops.
const CATEGORY_ORDER = ["Achievement", "Task", "Work", "Memory"];

export function computeCategoryCounts(captures: Capture[], userId: string): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const capture of ownCaptures(captures, userId)) {
    counts.set(capture.category, (counts.get(capture.category) ?? 0) + 1);
  }

  return CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => ({
    category,
    count: counts.get(category) as number,
  }));
}

export type CompletionStats = {
  completed: number;
  active: number;
};

// status can also be "deleted" in the Capture type, but deleteCapture()
// is always a hard DELETE in this codebase (confirmed - no code path
// ever writes status: "deleted"), so there's nothing to filter out here
// in practice; every own capture is either "active" or "completed".
export function computeCompletionStats(captures: Capture[], userId: string): CompletionStats {
  const own = ownCaptures(captures, userId);
  return {
    completed: own.filter((capture) => capture.status === "completed").length,
    active: own.filter((capture) => capture.status === "active").length,
  };
}
