import type { Capture } from "@/app/lib/captures";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function daysBetween(earlier: Date, later: Date) {
  const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatRelativeDay(date: Date, today: Date) {
  const diff = daysBetween(date, today);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

function BriefingCard({
  icon,
  tone,
  label,
  headline,
  detail,
  detailTone = "text-gray-400",
  onClick,
}: {
  icon: string;
  tone: string;
  label: string;
  headline: string;
  detail: string;
  detailTone?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${tone}`}>
          {icon}
        </span>
        <h3 className="font-semibold text-sm text-gray-900">{label}</h3>
      </div>
      <p className="text-sm text-gray-800 break-words line-clamp-2">{headline}</p>
      <p className={`text-xs mt-1 ${detailTone}`}>{detail}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-2xl bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
      >
        {content}
      </button>
    );
  }

  return <div className="rounded-2xl bg-gray-50 p-4">{content}</div>;
}

export default function DailyBriefingCard({
  captures,
  onSelectCapture,
}: {
  captures: Capture[];
  onSelectCapture: (id: number) => void;
}) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const todaysTasks = captures
    .filter((capture) => capture.category === "Task" && isSameDay(new Date(capture.createdAt), now))
    .slice(0, 5);
  const focusItems =
    todaysTasks.length > 0
      ? todaysTasks
      : captures.filter((capture) => capture.category === "Task").slice(0, 5);
  const focusItem = focusItems[0] ?? null;

  const achievements = captures.filter((capture) => capture.category === "Achievement");
  const yesterdaysWin = achievements.find((capture) =>
    isSameDay(new Date(capture.createdAt), yesterday)
  );
  const win = yesterdaysWin ?? achievements[0] ?? null;
  const winLabel = yesterdaysWin ? "Yesterday's Win" : "Recent Win";

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <BriefingCard
        icon="🎯"
        tone="bg-amber-100"
        label="Today's Focus"
        headline={focusItem?.text ?? "No tasks captured yet — tap Drop to add one."}
        detail={
          focusItems.length === 0
            ? ""
            : `${focusItems.length} task${focusItems.length === 1 ? "" : "s"} on deck`
        }
        detailTone="text-amber-600"
        onClick={focusItem ? () => onSelectCapture(focusItem.id) : undefined}
      />

      <BriefingCard
        icon="🌟"
        tone="bg-emerald-100"
        label={winLabel}
        headline={win?.text ?? "Nothing marked as a win yet."}
        detail={win ? formatRelativeDay(new Date(win.createdAt), now) : ""}
        onClick={win ? () => onSelectCapture(win.id) : undefined}
      />
    </section>
  );
}
