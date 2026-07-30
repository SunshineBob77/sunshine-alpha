import { defaultSpaces } from "./spaces";

// Color moved out entirely - see spaceColors.ts (getSpaceColor) for the
// unified identity/fill hex system. This module is now just name+icon
// lookup, the one piece that was never duplicated between the old
// light/dark systems in the first place.
export const unassignedSpaceTone = {
  name: "Unsorted",
  icon: "📦",
};

// Fixed visual identity for Sunshine Drop cards (system-generated Drops -
// capture.source === "system", e.g. Daily Brief). DropCard is responsible
// for using this instead of getSpaceTone whenever isSunshineDrop is true -
// see DropCard.tsx. Color for these cards comes from spaceColors.ts's
// sunshineSpaceColor, kept deliberately separate from real Space colors.
export const sunshineDropTone = {
  name: "SUNSHINE",
  icon: "☀️",
};

// Minimal shape every caller needs from a real Shared Space (a subset of
// sharedSpaces.ts's MySpace - callers pass that array directly, this type
// exists so spaceTone.ts doesn't have to import from there and create a
// two-way dependency between the two lib modules). No color/border here
// anymore - a real Shared Space's color is derived from its id via
// spaceColors.ts's getSpaceColor, never read off this object.
export type SharedSpaceLookup = {
  id: string;
  name: string;
  icon: string;
};

// sharedSpaces defaults to [] (not required) specifically so DropCard.tsx
// keeps working unchanged for the public share page (app/s/[id]/page.tsx),
// which has no DashboardProvider/useCaptures() to fetch a caller's shared
// spaces from in the first place - it just falls back to the previous
// personal-only-else-Unsorted behavior, same as today.
//
// Checked in this order (defaultSpaces first, then sharedSpaces) because a
// real Shared Space's id is a spaces-table uuid - it can never collide
// with one of defaultSpaces' fixed string ids ("personal", "work", etc.),
// so there's no ambiguity to resolve either way.
export function getSpaceTone(
  spaceId: string | null | undefined,
  sharedSpaces: SharedSpaceLookup[] = []
): { name: string; icon: string } {
  const space = defaultSpaces.find((candidate) => candidate.id === spaceId);
  if (space) return space;

  const shared = sharedSpaces.find((candidate) => candidate.id === spaceId);
  if (shared) return shared;

  return unassignedSpaceTone;
}
