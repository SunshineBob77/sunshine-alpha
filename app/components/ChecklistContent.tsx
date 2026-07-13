import type { ChecklistItem } from "@/app/lib/captures";

export default function ChecklistContent({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-amber-500 cursor-pointer"
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
