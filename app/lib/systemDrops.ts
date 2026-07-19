// Fixed category identity for every Sunshine Drop card (system-generated
// Drops - capture.source === "system", e.g. Daily Brief, and any future
// system_drop_type). Deliberately zero-dependency (no supabase client
// import, no other app/lib module) so it's safe to import from both API
// routes and client components without pulling in unrelated setup.
//
// This is the value analyze-drop/route.ts hard-assigns instead of running
// AI classification, and what daily-brief/route.ts writes at generation
// time - one shared constant so the two can never drift apart.
export const SUNSHINE_DROP_CATEGORY = "Sunshine";

// Daily Brief carousel v1 - four independent system Drops sharing one
// group_id (see docs/daily-brief-carousel-schema.sql), rendered together
// via the same DropGroupCarousel mechanism Card Carousel v2 already uses
// for user Drops - not one capture with internally-paged content the way
// an earlier same-night iteration built it. Each gets its own
// system_drop_type so all 4 can coexist for the same (user, day) and each
// can be idempotently upserted independently. Shared between
// daily-brief/route.ts (writes them) and LifelineDropCard.tsx (reads them,
// to decide which structured tappable content to render instead of plain
// markdown) so the two can never drift apart, same reasoning as
// SUNSHINE_DROP_CATEGORY above.
export const DAILY_BRIEF_ACTIVITY_TYPE = "daily_brief_activity";
export const DAILY_BRIEF_SPACES_TYPE = "daily_brief_spaces";
export const DAILY_BRIEF_CATEGORIES_TYPE = "daily_brief_categories";
export const DAILY_BRIEF_COMPLETION_TYPE = "daily_brief_completion";

export const DAILY_BRIEF_SYSTEM_DROP_TYPES = [
  DAILY_BRIEF_ACTIVITY_TYPE,
  DAILY_BRIEF_SPACES_TYPE,
  DAILY_BRIEF_CATEGORIES_TYPE,
  DAILY_BRIEF_COMPLETION_TYPE,
] as const;

// The old single-capture-Drop value this replaces - used only by
// daily-brief/route.ts's per-day archive sweep, so anyone whose already-
// generated single-card brief predates this rework still gets it cleaned
// up going forward. Never written anywhere anymore.
export const LEGACY_DAILY_BRIEF_SYSTEM_DROP_TYPE = "daily_brief";
