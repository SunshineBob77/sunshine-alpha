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

// system_drop_type value for the Daily Brief (replaces the old
// 'morning_brief' value - see docs/daily-brief-schema.sql). Shared between
// daily-brief/route.ts (writes it) and LifelineDropCard.tsx (reads it, to
// decide whether to render the structured tappable activity list instead
// of plain markdown content) so the two can never drift apart, same
// reasoning as SUNSHINE_DROP_CATEGORY above.
export const DAILY_BRIEF_SYSTEM_DROP_TYPE = "daily_brief";
