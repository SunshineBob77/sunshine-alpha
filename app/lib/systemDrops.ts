// Fixed category identity for every Sunshine Drop card (system-generated
// Drops - capture.source === "system", e.g. Morning Brief, and any future
// system_drop_type). Deliberately zero-dependency (no supabase client
// import, no other app/lib module) so it's safe to import from both API
// routes and client components without pulling in unrelated setup.
//
// This is the value analyze-drop/route.ts hard-assigns instead of running
// AI classification, and what morning-brief/route.ts writes at generation
// time - one shared constant so the two can never drift apart.
export const SUNSHINE_DROP_CATEGORY = "Sunshine";
