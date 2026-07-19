// Daily Brief "mini dashboard" cards (Spaces/Categories/Completion) -
// pure stat computation, now called ONCE server-side at generation time
// (app/api/daily-brief/route.ts), frozen into each card's own capture row
// (daily_brief_stats), same as every other system Drop in this app. An
// earlier same-night iteration called these same functions live,
// client-side, on every render - reversed per explicit decision once
// these became real independent Drops rather than sub-content inside one
// capture's content area ("a Drop's content changing on every render"
// would have been a first for this codebase).
//
// Deliberately scoped to the viewing user's OWN captures only
// (capture.userId === userId), not every Drop they can see (which for a
// Shared Space also includes teammates' Drops, via RLS). This is a
// personal stats dashboard - "what does MY Sunshine look like right
// now" - not a space-wide activity report the way Card 1's cross-member
// delta is. Keeps every card answering the same question, rather than
// mixing personal totals with teammates' volume on some cards and not
// others.
import type { Capture } from "./captures";
import type { MySpace } from "./sharedSpaces";
import { defaultSpaces } from "./spaces";

// Narrowed to exactly the fields these functions touch, rather than the
// full Capture/MySpace types - lets app/api/daily-brief/route.ts build
// these straight from a lightweight server-side query (just these
// columns) instead of needing to fabricate full client-shaped objects
// (~30 required fields on Capture) it has no other reason to construct.
// A real Capture/MySpace is still structurally assignable here - this is
// a strict subset, not a divergent shape - so nothing about the client
// side would need to change if these were ever called from there again.
export type StatsCapture = Pick<Capture, "userId" | "source" | "category" | "spaceIds" | "status">;
export type StatsSharedSpace = Pick<MySpace, "id" | "name" | "icon">;

function ownCaptures(captures: StatsCapture[], userId: string): StatsCapture[] {
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
  captures: StatsCapture[],
  userId: string,
  sharedSpaces: StatsSharedSpace[]
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

export function computeCategoryCounts(captures: StatsCapture[], userId: string): CategoryCount[] {
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
export function computeCompletionStats(captures: StatsCapture[], userId: string): CompletionStats {
  const own = ownCaptures(captures, userId);
  return {
    completed: own.filter((capture) => capture.status === "completed").length,
    active: own.filter((capture) => capture.status === "active").length,
  };
}

// Self-describing payload stored in captures.daily_brief_stats - a
// renderer only needs this one column (via the `kind` tag) to know how
// to interpret it, no separate cross-reference against system_drop_type
// required. Null on every row except the 3 stat cards this covers - the
// Activity card keeps using the existing daily_brief_activity column.
export type DailyBriefStatsPayload =
  | { kind: "spaces"; sharedSpaceCount: number; items: SpaceDropCount[] }
  | { kind: "categories"; items: CategoryCount[] }
  | { kind: "completion"; completed: number; active: number };

// Plain-text fallbacks (content/formatted_text) - used everywhere that
// isn't the Lifeline feed's own tappable rendering (search results, the
// public share page, Ask's bare DropCard), same role
// dailyBrief.ts's buildDailyBriefContent plays for the Activity card.

export function buildDailyBriefSpacesContent(
  sharedSpaceCount: number,
  items: SpaceDropCount[]
): string {
  const header = `You're a member of ${sharedSpaceCount} Shared Space${sharedSpaceCount === 1 ? "" : "s"}.`;
  if (items.length === 0) return `${header}\nNo Drops yet.`;

  const lines = items.map((space) => `${space.spaceName}: ${space.count} Drop${space.count === 1 ? "" : "s"}`);
  return [header, ...lines].join("\n");
}

export function buildDailyBriefCategoriesContent(items: CategoryCount[]): string {
  if (items.length === 0) return "No Drops yet.";
  return items.map(({ category, count }) => `${category}: ${count}`).join("\n");
}

export function buildDailyBriefCompletionContent({ completed, active }: CompletionStats): string {
  return `${completed} completed\n${active} active`;
}
