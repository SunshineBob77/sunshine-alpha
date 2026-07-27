"use client";

import { useCaptures } from "@/app/lib/DashboardContext";
import { formatRelativeTime } from "@/app/lib/relativeTime";

// Home screen v1 - the single most recent real (source="user") Drop.
// Explicitly re-sorts rather than trusting captures[0]'s incidental
// order (fetchCaptures does sort createdAt-descending and saveCapture
// prepends new ones, so captures[0] would usually already be it - but
// that's an implementation detail of the loaded array, not a contract
// this component should quietly depend on).
export default function RecentCaptureCard({
  onSelectCapture,
}: {
  onSelectCapture: (id: number) => void;
}) {
  const { captures } = useCaptures();

  const recent = captures
    .filter((capture) => capture.source === "user")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!recent) return null;

  return (
    <section className="rounded-2xl bg-dusk ring-1 ring-ink/10 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-dim mb-3">
        Recent Capture
      </h2>
      <button type="button" onClick={() => onSelectCapture(recent.id)} className="block w-full text-left">
        <p className="font-semibold text-ink truncate">{recent.title ?? recent.sunshineSummary}</p>
        <p className="text-sm text-ink-dim mt-1 line-clamp-2">
          {recent.formattedText ?? recent.text}
        </p>
        <p className="text-xs text-ink-dim mt-2 opacity-70">
          {formatRelativeTime(recent.createdAt)}
        </p>
      </button>
    </section>
  );
}
