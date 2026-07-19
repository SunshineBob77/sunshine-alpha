"use client";

import type { CategoryCount } from "@/app/lib/dailyBriefStats";

// Daily Brief carousel v1 - the "Categories" card's own content. items is
// the frozen snapshot from capture.dailyBriefStats, computed once at
// generation time - not recomputed here.
export default function DailyBriefCategoriesContent({ items }: { items: CategoryCount[] }) {
  if (items.length === 0) {
    return <p className="text-ink-dim">No Drops yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map(({ category, count }) => (
        <li key={category} className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate">{category}</span>
          <span className="shrink-0 text-ink-dim">{count}</span>
        </li>
      ))}
    </ul>
  );
}
