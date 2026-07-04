import type { Capture } from "@/app/lib/captures";

const stoicQuotes = [
  { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "He who is brave is free.", author: "Seneca" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Only the educated are free.", author: "Epictetus" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { text: "How much more grievous are the consequences of anger than the causes of it.", author: "Marcus Aurelius" },
  { text: "The best revenge is to be unlike him who performed the injury.", author: "Marcus Aurelius" },
  { text: "Man conquers the world by conquering himself.", author: "Zeno of Citium" },
  { text: "Well-being is realized by small steps, but is truly no small thing.", author: "Zeno of Citium" },
  { text: "He suffers more than necessary, who suffers before it is necessary.", author: "Seneca" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "Every new beginning comes from some other beginning's end.", author: "Seneca" },
  { text: "Circumstances don't make the man, they only reveal him to himself.", author: "Epictetus" },
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

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

function SectionHeading({
  icon,
  tone,
  children,
}: {
  icon: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${tone}`}
      >
        {icon}
      </span>
      <h3 className="font-semibold text-lg text-gray-900">{children}</h3>
    </div>
  );
}

export default function DailyBriefingCard({ captures }: { captures: Capture[] }) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const dayOfYear = getDayOfYear(now);
  const quoteOfTheDay = stoicQuotes[dayOfYear % stoicQuotes.length];

  const todaysTasks = captures
    .filter((capture) => capture.category === "Task" && isSameDay(new Date(capture.createdAt), now))
    .slice(0, 5);
  const focusItems =
    todaysTasks.length > 0
      ? todaysTasks
      : captures.filter((capture) => capture.category === "Task").slice(0, 5);

  const achievements = captures.filter((capture) => capture.category === "Achievement");
  const yesterdaysWin = achievements.find((capture) =>
    isSameDay(new Date(capture.createdAt), yesterday)
  );
  const win = yesterdaysWin ?? achievements[0] ?? null;
  const winLabel = yesterdaysWin ? "Yesterday's Win" : "Recent Win";

  return (
    <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-left">
      <p className="italic text-lg mb-6 text-gray-800">
        "{quoteOfTheDay.text}"{" "}
        <span className="not-italic text-gray-500 text-base">- {quoteOfTheDay.author}</span>
      </p>

      <SectionHeading icon="🎯" tone="bg-amber-100">
        Today's Focus
      </SectionHeading>
      {focusItems.length === 0 ? (
        <p className="mb-7 text-gray-500">No tasks captured yet — tap Capture to add one.</p>
      ) : (
        <ul className="list-disc ml-6 mb-7 text-gray-700 space-y-1">
          {focusItems.map((capture) => (
            <li key={capture.id}>{capture.text}</li>
          ))}
        </ul>
      )}

      <SectionHeading icon="🌟" tone="bg-emerald-100">
        {winLabel}
      </SectionHeading>
      {win === null ? (
        <p className="text-gray-500">
          Nothing marked as a win yet — capture something great and it'll show up here.
        </p>
      ) : (
        <p className="text-gray-700">
          {win.text}{" "}
          <span className="text-sm text-gray-400">
            ({formatRelativeDay(new Date(win.createdAt), now)})
          </span>
        </p>
      )}
    </section>
  );
}
