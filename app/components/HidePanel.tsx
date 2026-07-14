// Shared between DropCard and DropDetailModal - both independently own
// their own expand/collapse state (see each file's own expandedPanel
// state), but the panel CONTENTS and behavior here are identical in
// both places, so only this piece is factored out.
//
// variant: "light" (default) is the existing, unchanged appearance -
// used by DropDetailModal, which doesn't pass this prop. "dark" is
// scoped to the Lifeline feed screen's restyle only.
export default function HidePanel({
  onToday,
  onWeek,
  onArchive,
  variant = "light",
}: {
  onToday: () => void;
  onWeek: () => void;
  onArchive: () => void;
  variant?: "light" | "dark";
}) {
  const buttonClass =
    variant === "dark"
      ? "text-xs font-semibold bg-ink/5 hover:bg-ink/10 text-ink-dim px-2.5 py-1.5 rounded-full transition-all"
      : "text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full transition-all";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={onToday} className={buttonClass}>
        Today
      </button>
      <button type="button" onClick={onWeek} className={buttonClass}>
        Week
      </button>
      <button type="button" onClick={onArchive} className={buttonClass}>
        🗄️ Archive
      </button>
    </div>
  );
}
