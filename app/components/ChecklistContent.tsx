import type { ChecklistItem } from "@/app/lib/captures";

export default function ChecklistContent({
  items,
  onToggle,
  readOnly = false,
}: {
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
  // Shared-space captures are view-all/edit-own-only - someone else's
  // checklist still needs to be visible, just not interactive. A native
  // disabled checkbox communicates that (cursor, greyed styling) rather
  // than a clickable-looking control that silently no-ops.
  readOnly?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <label className={`flex items-start gap-2 ${readOnly ? "cursor-default" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              disabled={readOnly}
              className="mt-1 h-4 w-4 shrink-0 accent-amber-500 cursor-pointer disabled:cursor-default disabled:opacity-60"
            />
            <span
              className={`break-words leading-relaxed ${
                item.checked ? "line-through text-gray-400" : ""
              }`}
            >
              {item.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
