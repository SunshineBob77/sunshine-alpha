"use client";

// Daily Brief carousel v1 - the "Completion" card's own content.
// completed/active are the frozen snapshot from capture.dailyBriefStats,
// computed once at generation time - not recomputed here.
export default function DailyBriefCompletionContent({
  completed,
  active,
}: {
  completed: number;
  active: number;
}) {
  return (
    <ul className="space-y-1.5">
      <li className="flex items-center gap-2">
        <span className="text-base shrink-0">✅</span>
        <span>{completed} completed</span>
      </li>
      <li className="flex items-center gap-2">
        <span className="text-base shrink-0">🔲</span>
        <span>{active} active</span>
      </li>
    </ul>
  );
}
