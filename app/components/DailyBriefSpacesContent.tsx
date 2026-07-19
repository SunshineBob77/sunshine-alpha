"use client";

import type { SpaceDropCount } from "@/app/lib/dailyBriefStats";

// Daily Brief carousel v1 - the "Spaces" card's own content, one full
// independent DropCard's worth (not a page within a shared carousel the
// way an earlier same-night iteration built it). items/sharedSpaceCount
// are the frozen snapshot from capture.dailyBriefStats, computed once at
// generation time - not recomputed here.
export default function DailyBriefSpacesContent({
  items,
  sharedSpaceCount,
  onNavigateToSpace,
}: {
  items: SpaceDropCount[];
  sharedSpaceCount: number;
  onNavigateToSpace: (spaceId: string) => void;
}) {
  return (
    <div>
      <p className="text-ink-dim mb-2">
        You&apos;re a member of {sharedSpaceCount} Shared Space{sharedSpaceCount === 1 ? "" : "s"}.
      </p>
      {items.length === 0 ? (
        <p className="text-ink-dim">No Drops yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((space) => (
            <li key={space.spaceId}>
              <button
                type="button"
                onClick={() => onNavigateToSpace(space.spaceId)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 text-left transition-all hover:bg-ink/5"
              >
                <span className="text-base shrink-0">{space.spaceIcon}</span>
                {/* Label and count are separate flex items - min-w-0 +
                    flex-1 + truncate on the label absorbs all the width
                    pressure (a long Space name shrinks/ellipsizes), and
                    shrink-0 on the count means it's never a candidate for
                    shrinking or wrapping itself. */}
                <span className="min-w-0 flex-1 truncate font-semibold leading-relaxed">
                  {space.spaceName}
                </span>
                <span className="shrink-0 text-ink-dim leading-relaxed">
                  {space.count} Drop{space.count === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
