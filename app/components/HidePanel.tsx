// Shared between DropCard and DropDetailModal - both independently own
// their own expand/collapse state (see each file's own expandedPanel
// state), but the panel CONTENTS and behavior here are identical in
// both places, so only this piece is factored out.
export default function HidePanel({
  onToday,
  onWeek,
  onArchive,
}: {
  onToday: () => void;
  onWeek: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={onToday}
        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full transition-all"
      >
        Today
      </button>
      <button
        type="button"
        onClick={onWeek}
        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full transition-all"
      >
        Week
      </button>
      <button
        type="button"
        onClick={onArchive}
        className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full transition-all"
      >
        🗄️ Archive
      </button>
    </div>
  );
}
