// Unified Space color system v1 - replaces the two disconnected systems
// that existed before this: spaceTone.ts's dark-only spaceAccentColors
// hex map, and spaces.ts/the spaces DB table's separate light-only
// Tailwind color/border class pairs. One record per Space now carries
// both an `identity` hex (used for borders/icons/accents in BOTH themes -
// the same hue is meant to read as "this Space" regardless of light or
// dark) and a `fill` hex (a light-mode-only pale tint for chip/tile
// backgrounds - dark mode has no separate fill, it just uses the card
// token, see globals.css).
//
// Six of these pairs (family/health/work/harvard/personal + sunshine) are
// exact values from the design spec. The rest (ideas/travel/recipes/
// finance/shared[folder]/completed/hidden/archived) weren't in that spec -
// confirmed with the user rather than inventing new hues: carry forward
// each one's existing pre-unification production hex as `identity`
// unchanged, then derive `fill` mechanically via mixWithWhite at the same
// ~85-90% white-blend ratio the six given pairs imply (FILL_BLEND_RATIO
// below, 87.5% - the midpoint of that range).
export type SpaceColorEntry = { identity: string; fill: string };

// ~85-90% white blend, per the user's explicit derivation instruction -
// reused for both the carried-forward fixed entries below AND
// generateSpaceColor's hash-based per-instance colors, so a fixed and a
// generated entry look consistent with each other (same identity-to-fill
// relationship everywhere, not two different formulas).
const FILL_BLEND_RATIO = 0.875;

function mixWithWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`.toUpperCase();
}

// Fixed per-Space identity+fill, keyed by the same string ids
// defaultSpaces (spaces.ts) already uses. "harvard" isn't a real,
// assignable Space anywhere in this app yet (no custom-Space creation
// mechanism exists) - included anyway, per the design spec explicitly
// naming it, so it's ready the moment a Space with that id exists.
// "shared" here is ONLY the defaultSpaces folder/entry-point tile (see
// SharedSpacesTile.tsx) - a REAL user-created Shared Space instance never
// looks itself up here, it gets its own unique pair from
// generateSpaceColor below instead (see getSpaceColor's fallback).
const FIXED_SPACE_COLORS: Record<string, SpaceColorEntry> = {
  family: { identity: "#F0A339", fill: "#FBEBD2" },
  health: { identity: "#E24B4A", fill: "#FBDEDD" },
  work: { identity: "#378ADD", fill: "#DCEBFB" },
  harvard: { identity: "#639922", fill: "#E4EFD8" },
  personal: { identity: "#D4537E", fill: "#F8DFE7" },
  ideas: { identity: "#8B5FBF", fill: "#F1EBF7" },
  travel: { identity: "#35B4C9", fill: "#E6F6F8" },
  recipes: { identity: "#A8A424", fill: "#F4F4E4" },
  finance: { identity: "#2F9E71", fill: "#E5F3ED" },
  shared: { identity: "#5C6BC0", fill: "#EBEDF7" },
  completed: { identity: "#5C7A87", fill: "#EBEEF0" },
  hidden: { identity: "#8A94A6", fill: "#F0F2F4" },
  archived: { identity: "#6B6B70", fill: "#EDEDED" },
};

// Fixed visual identity for Sunshine Drop cards (system-generated Drops -
// capture.source === "system", e.g. Daily Brief) - deliberately NOT in
// FIXED_SPACE_COLORS, so it can never collide with a real Space's color
// even by coincidence. DropCard is responsible for using this instead of
// getSpaceColor whenever isSunshineDrop is true.
export const sunshineSpaceColor: SpaceColorEntry = { identity: "#FFC940", fill: "#FFF3D2" };

// No Space assigned / unrecognized id - neutral gray so the color-coding
// stays meaningful (a real Space = a real color) rather than an
// unclassified Drop defaulting to something that looks like a real,
// intentional Space color. Same hex as "archived" (both already neutral
// grays pre-unification) - not a new decision, just where the math lands.
export const unassignedSpaceColor: SpaceColorEntry = { identity: "#6B6B70", fill: "#EDEDED" };

// Deterministic hash - same seed always produces the same hue, so a real
// Shared Space's color is stable across renders/sessions/devices without
// needing to store anything extra in the DB. Seeded on the Space's own
// id (a stable uuid, always present, already unique) rather than its
// name (which can be renamed later - the color must not change when
// that happens).
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) =>
    lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// Real user-created Shared Spaces (the `spaces` DB table, created via
// createSharedSpace/invite redemption) previously had NO real per-instance
// color at all - the table's color/border columns are static defaults
// ('bg-pink-100'/'border-pink-400', see docs/shared-spaces-schema.sql),
// identical for every Shared Space ever created, not generated per
// instance. So this isn't "extending existing generation logic" (there
// wasn't any) - it's new: a stable hue picked from the space's own id via
// a plain string hash, at a fixed saturation/lightness chosen to sit in
// the same vividness range as the six given identity colors, then the
// same mixWithWhite/FILL_BLEND_RATIO used everywhere else in this file
// derives its fill - so a generated pair looks consistent with a fixed
// one, and the identity/fill relationship is identical everywhere in the
// app, not a second formula.
function generateSpaceColor(seed: string): SpaceColorEntry {
  const hue = hashString(seed) % 360;
  const identity = hslToHex(hue, 70, 55);
  const fill = mixWithWhite(identity, FILL_BLEND_RATIO);
  return { identity, fill };
}

// Minimal shape needed to recognize "this id is a real Shared Space" -
// deliberately just {id}, not the full MySpace/SharedSpaceLookup shape,
// since color no longer comes from any field on that object.
export function getSpaceColor(
  spaceId: string | null | undefined,
  sharedSpaces: { id: string }[] = []
): SpaceColorEntry {
  if (!spaceId) return unassignedSpaceColor;
  if (FIXED_SPACE_COLORS[spaceId]) return FIXED_SPACE_COLORS[spaceId];
  if (sharedSpaces.some((candidate) => candidate.id === spaceId)) {
    return generateSpaceColor(spaceId);
  }
  return unassignedSpaceColor;
}
