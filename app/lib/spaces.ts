export type Space = {
  id: string;
  name: string;
  icon: string;
  isShared: boolean;
  // System spaces are auto-populated (membership computed, not manually assigned)
  // and are never shown in space-assignment UI (e.g. the SpacePicker).
  isSystem?: boolean;
};

// Unified theme system v1 - color/border (previously a Tailwind class
// pair per entry, e.g. "bg-yellow-100"/"border-yellow-400") moved out
// entirely. A Space's color now comes from spaceColors.ts's
// getSpaceColor(id), keyed by the same id used here - see that file for
// the identity/fill hex pairs.
export const defaultSpaces: Space[] = [
  { id: "personal", name: "Personal", icon: "🏠", isShared: false },
  { id: "work", name: "Work", icon: "💼", isShared: false },
  { id: "health", name: "Health", icon: "❤️", isShared: false },
  { id: "family", name: "Family", icon: "👪", isShared: false },
  { id: "finance", name: "Finance", icon: "💰", isShared: false },
  { id: "ideas", name: "Ideas", icon: "💡", isShared: false },
  { id: "travel", name: "Travel", icon: "✈️", isShared: false },
  { id: "recipes", name: "Recipes", icon: "🍳", isShared: false },
  // Folder/entry-point, not a real Space of its own - real shared spaces
  // live in the spaces table (see app/lib/sharedSpaces.ts) and are
  // rendered via SharedSpacesTile.tsx / spaces/shared/page.tsx, not this
  // hardcoded entry. This id/icon still drives the Spaces tab tile's
  // look and the Lifeline pill's label - both read from defaultSpaces
  // the same way they read every other entry here.
  { id: "shared", name: "Shared Spaces", icon: "👥", isShared: true },
  // Pinned v2 - no longer a full system Space entry here (a global "Pinned"
  // filter still exists, restored as a hardcoded pill in page.tsx's
  // filterOptions instead, since that row only ever needed {id, name} -
  // see the NON_SPACE_FILTER_IDS comment below). Pinned Drops ALSO surface
  // as a sub-section at the top of each individual Space's own Lifeline
  // view - see LifelineFeed.tsx. Both coexist: the global pill shows every
  // pinned Drop across every Space, the per-Space sub-section shows just
  // that one Space's.
  { id: "completed", name: "Completed", icon: "✅", isShared: false, isSystem: true },
  { id: "hidden", name: "Hidden", icon: "🙈", isShared: false, isSystem: true },
  { id: "archived", name: "Archived", icon: "🗄️", isShared: false, isSystem: true },
];

export const assignableSpaces = defaultSpaces.filter((space) => !space.isSystem);

// Cross-cutting filters/ids that aren't a real, single Space to scope a
// Pinned sub-section (or a new capture) into - shared between page.tsx
// (the top-level filter pill row, and deciding whether a new capture
// should auto-tag into "this Space") and LifelineFeed.tsx (deciding
// whether the current activeFilter is "a specific Space" for the
// per-Space Pinned sub-section - see Pinned v2 above). "pinned" belongs
// here same as the rest: it's the global cross-Space filter, not a real
// Space's spaceIds value - without it here, a capture saved while the
// global Pinned filter is active would wrongly try to tag into a
// nonexistent "pinned" Space, and LifelineFeed would wrongly try to
// render a per-Space Pinned sub-section for it. A real personal or
// shared-Space id (including a spaces-table uuid, which never collides
// with any of these fixed strings) is anything NOT in this set.
export const NON_SPACE_FILTER_IDS = new Set(["all", "pinned", "completed", "hidden", "archived"]);
