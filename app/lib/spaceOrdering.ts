import type { Space } from "./spaces";
import type { Capture } from "./captures";

// Pinned-content Spaces first (any Space with >=1 pinned Drop), then pure
// recency (most-recently-created Drop first) for the rest - confirmed
// scope: no AI scoring call, computed entirely client-side from data
// already loaded. Operates on assignable (non-system) Spaces only -
// system Spaces (Completed, Pinned) are rendered separately, in a fixed
// position, not part of this ranked pool.
export function orderSpaces(spaces: Space[], captures: Capture[]): Space[] {
  function hasPinnedDrop(spaceId: string): boolean {
    return captures.some((capture) => capture.pinned && capture.spaceIds?.includes(spaceId));
  }

  function mostRecentCreatedAt(spaceId: string): number {
    let latest = 0;
    for (const capture of captures) {
      if (!capture.spaceIds?.includes(spaceId)) continue;
      const time = new Date(capture.createdAt).getTime();
      if (time > latest) latest = time;
    }
    return latest;
  }

  return [...spaces].sort((a, b) => {
    const aPinned = hasPinnedDrop(a.id);
    const bPinned = hasPinnedDrop(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return mostRecentCreatedAt(b.id) - mostRecentCreatedAt(a.id);
  });
}
