-- Fixes captures_system_daily_brief_carousel_unique
-- (docs/daily-brief-carousel-schema.sql) - confirmed live, 100%
-- reproducible on every single call: Postgres's ON CONFLICT (col1, col2,
-- col3) inference can only target a FULL unique constraint/index on
-- exactly those columns, never a PARTIAL one, even when the partial
-- index covers the same columns and would otherwise match. Every upsert
-- in app/api/daily-brief/route.ts was throwing:
--   42P10 "there is no unique or exclusion constraint matching the
--   ON CONFLICT specification"
-- Same class of bug already documented once in this codebase, on
-- redeem_invite()'s ON CONFLICT target (see
-- docs/space-invite-links-schema.sql) - this time on the client
-- (supabase-js upsert()) side instead of a raw SQL function body.
--
-- Run in Supabase SQL editor. Saved here for reference/history, not
-- applied automatically.
--
-- Safe to drop the WHERE predicate entirely rather than try to make
-- PostgREST's upsert emit a matching one - it can't: the supabase-js
-- upsert()/onConflict API has no way to attach an arbitrary WHERE clause
-- to the ON CONFLICT target at all, so a partial index can never be a
-- valid target for it, regardless of how the predicate is phrased.
-- generated_for_date is null for every ordinary user Drop (only this
-- route ever sets it, only for source='system' rows), and Postgres
-- treats NULL as distinct from every other NULL for uniqueness purposes
-- by default - so a full, non-partial index on (user_id,
-- generated_for_date, system_drop_type) only ever meaningfully
-- constrains the same rows the partial one did, just without the
-- now-provably-broken WHERE clause. No application code changes needed -
-- app/api/daily-brief/route.ts's onConflict string was already correct
-- SQL, it just needed a full index to actually match against.

drop index if exists captures_system_daily_brief_carousel_unique;

create unique index if not exists captures_system_daily_brief_carousel_unique
  on captures (user_id, generated_for_date, system_drop_type);
