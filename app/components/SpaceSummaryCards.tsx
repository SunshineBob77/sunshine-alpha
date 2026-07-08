import Link from "next/link";
import type { Capture } from "@/app/lib/captures";
import { defaultSpaces } from "@/app/lib/spaces";
import { summarizeSpace } from "@/app/lib/spaceSummary";

export default function SpaceSummaryCards({ captures }: { captures: Capture[] }) {
  const populatedSpaces = defaultSpaces
    .map((space) => ({
      space,
      captures: captures.filter((capture) => capture.spaceIds?.includes(space.id)),
    }))
    .filter((entry) => entry.captures.length > 0);

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
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {populatedSpaces.map(({ space, captures: spaceCaptures }) => {
        const { count, oneLiner } = summarizeSpace(spaceCaptures, space.id);

        return (
          <Link
            key={space.id}
            href={`/spaces?space=${space.id}`}
            className={`${space.color} rounded-2xl ring-1 ring-black/5 shadow-sm p-4 block hover:ring-black/10 hover:shadow-md transition-all`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{space.icon}</span>
                <span className="font-semibold text-gray-900">{space.name}</span>
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-white/60 px-2 py-1 rounded-full">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2">{oneLiner}</p>
          </Link>
        );
      })}
    </section>
  );
}
