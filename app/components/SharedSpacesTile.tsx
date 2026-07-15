"use client";

import { useRouter } from "next/navigation";
import type { Space } from "@/app/lib/spaces";

// Renders in place of SpaceTile for the "shared" entry in defaultSpaces -
// this is a folder/entry-point into the user's real shared spaces, not a
// renamable Space of its own, so it deliberately has no rename pencil
// (unlike every other non-system tile) and navigates to the sub-list
// instead of a Lifeline filter view.
export default function SharedSpacesTile({ space }: { space: Space }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/spaces/shared")}
      className={`relative ${space.color} rounded-2xl p-3 text-center ring-1 ring-black/5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all`}
    >
      <span
        className="absolute top-1.5 right-1.5 text-[10px] leading-none"
        title="Opens your shared spaces"
      >
        📂
      </span>
      <div className="text-2xl">{space.icon}</div>
      <div className="font-semibold text-gray-900 truncate">{space.name}</div>
      <div className="text-xs mt-1 text-gray-600">Shared</div>
    </button>
  );
}
