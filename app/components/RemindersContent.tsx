"use client";

import { useState } from "react";
import type { ReminderItem } from "@/app/lib/reminders";

function formatDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";

  const [ty, tm, td] = todayKey.split("-").map(Number);
  const tomorrowKey = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
  if (dateKey === tomorrowKey) return "Tomorrow";

  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ReminderSection({
  label,
  items,
  todayKey,
  onToggle,
  onSelectCapture,
}: {
  label: string;
  items: ReminderItem[];
  todayKey: string;
  onToggle: (captureId: number, dateKey: string) => void;
  onSelectCapture: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-ink-dim py-1"
      >
        <span>
          {label} · {items.length}
        </span>
        <span className="text-[10px]">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <ul className="space-y-1.5 mt-1">
          {items.map((item) => (
            <li key={`${item.captureId}-${item.dateKey}`} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(item.captureId, item.dateKey)}
                className="mt-1 h-4 w-4 shrink-0 accent-gold cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onSelectCapture(item.captureId)}
                className={`flex-1 min-w-0 text-left break-words leading-relaxed ${
                  item.checked ? "line-through text-ink-dim" : "text-ink"
                }`}
              >
                {item.title}
              </button>
              <span className="text-xs text-ink-dim shrink-0 mt-0.5">
                {formatDateLabel(item.dateKey, todayKey)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Preview row for the collapsed default state - a lighter-weight rendering
// of a single ReminderItem than ReminderSection's own <li> (no section
// context to sit inside), but the same checkbox/tap-to-open/date-label
// shape so toggling or opening a Drop from the collapsed preview behaves
// identically to doing it from the expanded sections below.
function PreviewRow({
  item,
  todayKey,
  onToggle,
  onSelectCapture,
}: {
  item: ReminderItem;
  todayKey: string;
  onToggle: (captureId: number, dateKey: string) => void;
  onSelectCapture: (id: number) => void;
}) {
  return (
    <li className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.captureId, item.dateKey)}
        className="mt-1 h-4 w-4 shrink-0 accent-gold cursor-pointer"
      />
      <button
        type="button"
        onClick={() => onSelectCapture(item.captureId)}
        className={`flex-1 min-w-0 text-left break-words leading-relaxed ${
          item.checked ? "line-through text-ink-dim" : "text-ink"
        }`}
      >
        {item.title}
      </button>
      <span className="text-xs text-ink-dim shrink-0 mt-0.5">
        {formatDateLabel(item.dateKey, todayKey)}
      </span>
    </li>
  );
}

// Collapsed by default (see PREVIEW_ITEM_COUNT) - shows only the soonest
// item(s) so the Reminders card reads as a quick glance, not a full
// agenda dump, every time the Lifeline loads. Tapping reveals the exact
// same "This week" / "Coming up" section UI that rendered unconditionally
// before this collapse behavior existed - nothing about that structure
// changed, it's just gated behind one extra tap now.
const PREVIEW_ITEM_COUNT = 2;

export default function RemindersContent({
  thisWeek,
  comingUp,
  todayKey,
  onToggle,
  onSelectCapture,
}: {
  thisWeek: ReminderItem[];
  comingUp: ReminderItem[];
  todayKey: string;
  onToggle: (captureId: number, dateKey: string) => void;
  onSelectCapture: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    // thisWeek and comingUp are each already date-ascending (they're built
    // from buildOccurrences' chronologically-sorted output, see
    // reminders.ts), and thisWeek's date range entirely precedes comingUp's
    // - so concatenating them, then taking the first few, is already "the
    // N soonest items overall" with no extra sort needed.
    const combined = [...thisWeek, ...comingUp];
    const previewItems = combined.slice(0, PREVIEW_ITEM_COUNT);
    const remaining = combined.length - previewItems.length;

    return (
      <div>
        <ul className="space-y-1.5">
          {previewItems.map((item) => (
            <PreviewRow
              key={`${item.captureId}-${item.dateKey}`}
              item={item}
              todayKey={todayKey}
              onToggle={onToggle}
              onSelectCapture={onSelectCapture}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs font-semibold text-gold"
        >
          {remaining > 0 ? `▸ Show ${remaining} more` : "▸ Show all"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ReminderSection
        label="This week"
        items={thisWeek}
        todayKey={todayKey}
        onToggle={onToggle}
        onSelectCapture={onSelectCapture}
      />
      <ReminderSection
        label="Coming up"
        items={comingUp}
        todayKey={todayKey}
        onToggle={onToggle}
        onSelectCapture={onSelectCapture}
      />
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="text-xs font-semibold text-gold"
      >
        ▾ Show less
      </button>
    </div>
  );
}
