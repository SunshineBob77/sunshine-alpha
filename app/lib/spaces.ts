export type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  border: string;
  isShared: boolean;
  // System spaces are auto-populated (membership computed, not manually assigned)
  // and are never shown in space-assignment UI (e.g. the SpacePicker).
  isSystem?: boolean;
};

export const defaultSpaces: Space[] = [
  { id: "personal", name: "Personal", icon: "🏠", color: "bg-yellow-100", border: "border-yellow-400", isShared: false },
  { id: "work", name: "Work", icon: "💼", color: "bg-blue-100", border: "border-blue-400", isShared: false },
  { id: "health", name: "Health", icon: "❤️", color: "bg-red-100", border: "border-red-400", isShared: false },
  { id: "family", name: "Family", icon: "👪", color: "bg-green-100", border: "border-green-400", isShared: false },
  { id: "finance", name: "Finance", icon: "💰", color: "bg-emerald-100", border: "border-emerald-400", isShared: false },
  { id: "ideas", name: "Ideas", icon: "💡", color: "bg-purple-100", border: "border-purple-400", isShared: false },
  { id: "travel", name: "Travel", icon: "✈️", color: "bg-sky-100", border: "border-sky-400", isShared: false },
  { id: "recipes", name: "Recipes", icon: "🍳", color: "bg-orange-100", border: "border-orange-400", isShared: false },
  // Folder/entry-point, not a real Space of its own - real shared spaces
  // live in the spaces table (see app/lib/sharedSpaces.ts) and are
  // rendered via SharedSpacesTile.tsx / spaces/shared/page.tsx, not this
  // hardcoded entry. This id/icon/color still drives the Spaces tab
  // tile's look and the Lifeline pill's label - both read from
  // defaultSpaces the same way they read every other entry here.
  { id: "shared", name: "Shared Spaces", icon: "👥", color: "bg-pink-100", border: "border-pink-400", isShared: true },
  // Pinned v2 - no longer a full system Space entry here (a global "Pinned"
  // filter still exists, restored as a hardcoded pill in page.tsx's
  // filterOptions instead, since that row only ever needed {id, name} -
  // see the NON_SPACE_FILTER_IDS comment below). Pinned Drops ALSO surface
  // as a sub-section at the top of each individual Space's own Lifeline
  // view - see LifelineFeed.tsx. Both coexist: the global pill shows every
  // pinned Drop across every Space, the per-Space sub-section shows just
  // that one Space's.
  { id: "completed", name: "Completed", icon: "✅", color: "bg-orange-100", border: "border-orange-400", isShared: false, isSystem: true },
  { id: "hidden", name: "Hidden", icon: "🙈", color: "bg-slate-200", border: "border-slate-400", isShared: false, isSystem: true },
  { id: "archived", name: "Archived", icon: "🗄️", color: "bg-gray-200", border: "border-gray-400", isShared: false, isSystem: true },
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
