import Link from "next/link";
import type { Capture } from "@/app/lib/captures";
import { defaultSpaces } from "@/app/lib/spaces";

export default function SpaceSummaryCards({ captures }: { captures: Capture[] }) {
  const populatedSpaces = defaultSpaces
    .map((space) => ({
      space,
      count: captures.filter((capture) => capture.spaceIds?.includes(space.id)).length,
    }))
    .filter((entry) => entry.count > 0);

  if (populatedSpaces.length === 0) {
    return (
      <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
        <p className="text-gray-600 text-lg">
          What are you working on? Tap Capture to get started.
        </p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {populatedSpaces.map(({ space, count }) => (
        <Link
          key={space.id}
          href={`/spaces?space=${space.id}`}
          className={`${space.color} rounded-2xl p-3 text-center ring-1 ring-black/5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all block`}
        >
          <div className="text-2xl">{space.icon}</div>
          <div className="font-semibold text-gray-900">{space.name}</div>
          <div className="text-xs mt-1 text-gray-600">
            {count} {count === 1 ? "item" : "items"}
          </div>
        </Link>
      ))}
    </section>
  );
}
