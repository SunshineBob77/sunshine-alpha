"use client";

import type { DailyBriefSpaceActivity } from "@/app/lib/dailyBrief";

function describeActivityCount({ type, count }: { type: string; count: number }): string {
  if (type === "added") return count === 1 ? "1 new Drop" : `${count} new Drops`;
  if (type === "edited") return count === 1 ? "1 edit" : `${count} edits`;
  return count === 1 ? `1 ${type}` : `${count} ${type}`;
}

export default function DailyBriefContent({
  items,
  onNavigateToSpace,
}: {
  items: DailyBriefSpaceActivity[];
  onNavigateToSpace: (spaceId: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-ink-dim">No new activity in your Shared Spaces since you were last here.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((space) => {
        const parts = space.activity.map(describeActivityCount).join(", ");
        const totalCount = space.activity.reduce((sum, item) => sum + item.count, 0);
        const attribution =
          totalCount === 1 && space.soleActorName ? ` from ${space.soleActorName}` : "";

        return (
          <li key={space.spaceId}>
            <button
              type="button"
              onClick={() => onNavigateToSpace(space.spaceId)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 text-left transition-all hover:bg-ink/5"
            >
              <span className="text-base shrink-0">{space.spaceIcon}</span>
              <span className="min-w-0 leading-relaxed">
                <span className="font-semibold">{space.spaceName}:</span> {parts}
                {attribution}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
