import { defaultSpaces } from "./spaces";

export const unassignedSpaceTone = {
  name: "Unsorted",
  icon: "📦",
  color: "bg-gray-100",
  border: "border-gray-300",
};

// Fixed visual identity for Sunshine Drop cards (system-generated Drops -
// capture.source === "system", e.g. Daily Brief) - deliberately NOT
// derived from spaceAccentColors/defaultSpaces at all, so it can never
// collide with a real Space's color even by coincidence. #FFC940 doesn't
// appear anywhere in spaceAccentColors below. DropCard is responsible for
// using this instead of getSpaceTone/getSpaceAccentColor whenever
// isSunshineDrop is true - see DropCard.tsx.
export const sunshineDropTone = {
  name: "SUNSHINE",
  icon: "☀️",
  color: "bg-amber-50",
  border: "border-amber-300",
};

export const sunshineDropAccentColor = "#FFC940";

export function getSpaceTone(spaceId: string | null | undefined) {
  const space = defaultSpaces.find((candidate) => candidate.id === spaceId);
  return space ?? unassignedSpaceTone;
}

// Per-Space accent color for the Lifeline feed screen's dark card border
// (2px, solid, one color per Space) - centrally defined here rather than
// per-card, and deliberately a plain hex-keyed map rather than Tailwind
// classes like getSpaceTone's color/border fields above: the card border
// needs a real per-value dynamic color (one of ~12 possible hexes chosen
// at render time), which Tailwind's static class scanning can't generate
// - a Tailwind arbitrary-value class only exists if that exact literal
// string appears in scanned source, so a runtime lookup like this has to
// go through an inline style, not a class name.
//
// "harvard" isn't currently a real, assignable Space anywhere in this
// codebase (not in defaultSpaces, no custom-Space creation mechanism
// exists at all yet) - included per the requested mapping anyway so it's
// ready the moment a Space with that id exists, but it has no visible
// effect today. Finance/Shared/Completed/Archived weren't in the
// requested list but needed *some* color for full coverage - picked
// reasonable, sufficiently-distinct ones for those too.
//
// "pinned" and "hidden" are system Space tiles for filtering/Organization
// display only - a real capture's spaceIds never actually contains either
// (pinned is capture.pinned, hidden is derived from hiddenUntil/isAutoHidden
// - see autoHide.ts - neither is a Space membership) - so these entries can
// never actually render as a card's own border color. Kept for
// completeness / potential future non-card use.
// completed/archived Drops are excluded from the "All" Lifeline filter
// entirely (see LifelineFeed.tsx), so those two are rarely if ever seen
// as a card border either - only in their own dedicated filter tabs.
export const spaceAccentColors: Record<string, string> = {
  family: "#F0A339",
  health: "#E24B4A",
  work: "#378ADD",
  harvard: "#639922",
  personal: "#D4537E",
  ideas: "#8B5FBF",
  travel: "#35B4C9",
  recipes: "#A8A424",
  finance: "#2F9E71",
  shared: "#5C6BC0",
  pinned: "#C9A227",
  completed: "#5C7A87",
  hidden: "#8A94A6",
  archived: "#6B6B70",
};

// No Space assigned / unrecognized id - neutral gray so the color-coding
// stays meaningful (a real Space = a real color) rather than an
// unclassified Drop defaulting to something that looks like a real,
// intentional Space color.
export const unassignedSpaceAccent = "#6B6B70";

export function getSpaceAccentColor(spaceId: string | null | undefined): string {
  if (!spaceId) return unassignedSpaceAccent;
  return spaceAccentColors[spaceId] ?? unassignedSpaceAccent;
}
