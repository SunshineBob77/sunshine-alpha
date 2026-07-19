-- Daily Brief carousel rework - replaces the single-capture, internally-
-- paged Daily Brief (docs/daily-brief-schema.sql) with 4 independent
-- system Drops sharing one group_id, rendered through the existing Card
-- Carousel v2 mechanism (DropGroupCarousel.tsx) instead of a bespoke
-- internal pager. "Everything is a Drop" - these are real, independent
-- captures now, not sub-content stuffed inside one capture's content area.
-- Run in Supabase SQL editor. Saved here for reference/history, not
-- applied automatically.
--
-- Card 1 (Activity) keeps its exact existing content/computation
-- (get_daily_brief_activity, daily_brief_activity column) - only its
-- title and its position as "one of 4 rows instead of the only row"
-- change. Cards 2-4 (Spaces/Categories/Completion) are new - and, per
-- explicit decision, frozen/server-computed once a day at generation
-- time, same as every other system Drop in this app, not recomputed live
-- client-side the way an earlier same-night iteration did.

-- ---------------------------------------------------------------------
-- One system_drop_type per card instead of one shared 'daily_brief'
-- value - each of the 4 rows for a given day needs its own identity so
-- all 4 can coexist and each can be idempotently upserted independently.
-- ---------------------------------------------------------------------

-- (No DDL needed for this part - system_drop_type is already a plain
-- text column with no CHECK constraint restricting its values; the new
-- literal values ('daily_brief_activity', 'daily_brief_spaces',
-- 'daily_brief_categories', 'daily_brief_completion') are just new
-- strings the app starts writing. See app/lib/systemDrops.ts.)

-- ---------------------------------------------------------------------
-- captures.daily_brief_stats - frozen stat snapshot for the 3 new cards
-- (Spaces/Categories/Completion), computed once at generation time by
-- app/api/daily-brief/route.ts using the same pure functions from
-- app/lib/dailyBriefStats.ts that an earlier same-night iteration called
-- live client-side. Self-describing via a `kind` field inside the JSON
-- (not just inferred from system_drop_type) so a renderer only needs
-- this one column, not a second lookup, to know how to interpret it.
-- Null for every row except the 3 new stat-card types - the Activity
-- card keeps using the existing daily_brief_activity column, unchanged.
-- ---------------------------------------------------------------------

alter table captures add column if not exists daily_brief_stats jsonb;

-- ---------------------------------------------------------------------
-- Replaces captures_system_daily_brief_unique (docs/daily-brief-schema.sql),
-- which was scoped to a single system_drop_type value and can't cover 4
-- coexisting rows for the same (user, day). The old index is left in
-- place (harmless - no row will ever match system_drop_type = 'daily_brief'
-- literally again, so it just sits inert) rather than dropped, matching
-- the same "leave the old one, add a new one" precedent from the
-- morning_brief -> daily_brief migration.
--
-- IN (...) in a partial index predicate is index-safe (a plain OR of
-- equality checks under the hood) - Postgres has no trouble using this
-- index for the exact-match lookups app/api/daily-brief/route.ts does.
-- ---------------------------------------------------------------------

create unique index if not exists captures_system_daily_brief_carousel_unique
  on captures (user_id, generated_for_date, system_drop_type)
  where source = 'system'
    and system_drop_type in (
      'daily_brief_activity',
      'daily_brief_spaces',
      'daily_brief_categories',
      'daily_brief_completion'
    );

-- ---------------------------------------------------------------------
-- One-time cleanup: archive any lingering unarchived row still using the
-- OLD singular 'daily_brief' type (anyone who already had today's
-- single-card brief generated before this ships) so it doesn't sit
-- alongside the new 4-card group as a stale 5th orphan forever. The
-- route's own per-day archive step is updated to sweep this old type
-- going forward too (see app/api/daily-brief/route.ts), but this handles
-- whatever already exists as of right now.
-- ---------------------------------------------------------------------

update captures
set archived_at = now()
where source = 'system'
  and system_drop_type = 'daily_brief'
  and archived_at is null;
