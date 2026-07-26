import type { Capture } from "./captures";

// Card Carousel v2 (originally user-Drop-only, now also used by the Daily
// Brief carousel's 4 linked system Drops) - a purely presentational
// grouping pass over an already-filtered capture list. Extracted out of
// LifelineFeed.tsx so the Me screen's Daily Brief section (see
// app/(dashboard)/me/page.tsx) can group its own 4 linked cards into a
// carousel the exact same way, without duplicating this logic.
//
// A group member that got individually filtered out of the caller's list
// (e.g. it was just completed) simply isn't part of `members` here either,
// with zero extra logic - what makes "the carousel advances to the next
// non-completed card" fall out for free.
//
// Ordered by createdAt ascending (insertion order) within a group, with id
// as a tiebreaker - a multi-row insert in one statement (see
// app/api/daily-brief/route.ts) can give every row in the group the exact
// same created_at (Postgres's now() is stable within a single statement),
// so createdAt alone isn't always a strict order; id always is, since it's
// a real per-row auto-incrementing sequence.
export function groupCapturesByGroupId(
  list: Capture[]
): { key: string; members: Capture[] }[] {
  const renderedGroupIds = new Set<string>();
  const items: { key: string; members: Capture[] }[] = [];

  for (const capture of list) {
    if (!capture.groupId) {
      items.push({ key: String(capture.id), members: [capture] });
      continue;
    }
    if (renderedGroupIds.has(capture.groupId)) continue;
    renderedGroupIds.add(capture.groupId);

    const members = list
      .filter((sibling) => sibling.groupId === capture.groupId)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id
      );
    items.push({ key: capture.groupId, members });
  }

  return items;
}
