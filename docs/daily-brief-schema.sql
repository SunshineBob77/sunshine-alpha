-- Daily Brief v1 — replaces Morning Brief (weather/quote/greeting) with a
-- per-Space "what happened while you were away" activity summary.
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Every statement below is written to be safely re-runnable from the top -
-- ADD COLUMN/CREATE INDEX/CREATE TRIGGER/RENAME COLUMN/DROP COLUMN aren't
-- idempotent in Postgres by default (they error if the target already
-- exists/doesn't exist), so each one is guarded (IF NOT EXISTS/IF EXISTS,
-- or a DO block existence check where no such clause exists). The two
-- one-time backfill UPDATEs (profiles.last_visited_at, captures.updated_at)
-- are moved inside their column's DO block specifically so they only ever
-- run once, at first column creation - rerunning a bare backfill UPDATE
-- on a later pass would clobber real values the app/trigger had already
-- written since the first run (e.g. reset a genuinely-edited Drop's
-- updated_at back to created_at, destroying the very edit signal this
-- schema exists to capture).

-- ---------------------------------------------------------------------
-- profiles.last_visited_at — the read-pointer this whole feature is
-- built around. Nullable at the column level (a fresh signup has no
-- history to summarize), but backfilled to now() for every existing row
-- and defaulted to now() going forward, so day one of this feature never
-- dumps a user's entire capture history into their first Brief - it
-- starts clean and only reports activity from here on.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_visited_at'
  ) then
    alter table profiles add column last_visited_at timestamptz;
    update profiles set last_visited_at = now();
  end if;
end $$;

alter table profiles alter column last_visited_at set default now();

-- ---------------------------------------------------------------------
-- captures.updated_at — did not exist before this. No existing write
-- path (updateCaptureText/Status/ChecklistItems/Spaces/etc. in
-- app/lib/captures.ts) touched any timestamp on UPDATE, so there was no
-- way to tell "created" apart from "edited" at all.
--
-- A BEFORE UPDATE trigger (not per-callsite app code) is the source of
-- truth here, so every current and future write path gets this for free
-- without having to remember to set it. It only bumps on columns that
-- read as a genuine content edit - deliberately NOT on state/housekeeping
-- toggles (pinned, hidden_until, user_archived_at, archived_at, status,
-- previous_state, reminder_dismissed_dates, event_*) so that e.g. hiding
-- and unhiding your own Drop a few times doesn't show up as "5 edits" in
-- someone else's Daily Brief. Column list is a judgment call - text,
-- formatted_text, title, checklist_items (genuine content) and space_ids
-- (moving a Drop into/out of a Space is meaningfully an "edit" from a
-- fellow Space member's point of view). Revisit this list if it turns
-- out to under- or over-report.
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'captures' and column_name = 'updated_at'
  ) then
    alter table captures add column updated_at timestamptz not null default now();
    update captures set updated_at = created_at;
  end if;
end $$;

create or replace function public.bump_captures_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (
    new.text is distinct from old.text
    or new.formatted_text is distinct from old.formatted_text
    or new.title is distinct from old.title
    or new.checklist_items is distinct from old.checklist_items
    or new.space_ids is distinct from old.space_ids
  ) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists captures_bump_updated_at on captures;

create trigger captures_bump_updated_at
  before update on captures
  for each row execute function public.bump_captures_updated_at();

-- ---------------------------------------------------------------------
-- captures.daily_brief_activity — structured per-Space activity, computed
-- once at generation time (see app/api/daily-brief/route.ts) and stored
-- alongside the plain-text content/text columns (used as the fallback
-- rendering everywhere that isn't the Lifeline feed - search results, the
-- public share page, Ask's bare DropCard). Lets the Lifeline feed render
-- each Space line as a real tappable control instead of parsing markdown.
-- Null for every row except source='system'/system_drop_type='daily_brief'.
-- No backfill needed (nullable, no prior column to migrate from), so a
-- plain IF NOT EXISTS is enough - no DO block required.
-- ---------------------------------------------------------------------

alter table captures add column if not exists daily_brief_activity jsonb;

-- ---------------------------------------------------------------------
-- Migration off the old Morning Brief system_drop_type. New Daily Brief
-- rows use a different system_drop_type ('daily_brief', not
-- 'morning_brief') so they need their own idempotency index rather than
-- reusing docs/morning-brief-schema.sql's - that one is left in place
-- (harmless, still valid for whatever old rows exist) rather than
-- dropped, since dropping it isn't necessary for anything to work.
--
-- Any not-yet-archived morning_brief row is archived here, once, so no
-- stale weather-report Drop keeps sitting pinned at the top of anyone's
-- Lifeline after the app switches over to generating daily_brief rows
-- instead - the existing per-day archive step in the route only ever
-- archived OTHER morning_brief rows for the same user, never a
-- morning_brief row when the code stops generating that type entirely.
-- The "and archived_at is null" guard already makes this naturally safe
-- to rerun (0 rows affected once everything's archived), no change needed.
-- ---------------------------------------------------------------------

update captures
set archived_at = now()
where source = 'system'
  and system_drop_type = 'morning_brief'
  and archived_at is null;

create unique index if not exists captures_system_daily_brief_unique
  on captures (user_id, generated_for_date)
  where source = 'system' and system_drop_type = 'daily_brief';

-- ---------------------------------------------------------------------
-- get_daily_brief_activity(p_user_id, p_since) - everything created or
-- content-edited since p_since, across every Shared Space p_user_id is an
-- active member of (Personal Spaces are out of scope for v1 - see
-- app/lib/spaces.ts, they're not DB rows at all and are always
-- self-authored anyway). Returns one row per Space with activity, an
-- extensible {type,count}[] breakdown (jsonb array - a future "comments"
-- type slots in without a schema change here), and sole_actor_name -
-- populated ONLY when a Space's total activity count is exactly 1, which
-- is the only case this ships attribution for ("ADG: 1 new Drop from
-- Mary"); anything more just shows counts ("Harvard Boxing: 5 edits"),
-- deliberately avoiding "5 edits from Mary, Bob, and Sue"-style
-- multi-actor aggregation in v1.
--
-- A user's OWN activity is deliberately excluded (c.user_id <>
-- p_user_id) - this is a "what did you miss" digest, not a log of your
-- own actions you were already there for. Flagging this as a judgment
-- call, not something explicitly specified.
--
-- Deliberately NOT security definer, and grant is service_role ONLY -
-- p_user_id is a raw parameter with no auth.uid() check against it, so
-- granting this to `authenticated` would let any signed-in user query
-- any other user's activity. Only ever called from
-- app/api/daily-brief/route.ts via supabaseAdmin (service_role, which
-- already bypasses RLS - no security-definer privilege escalation is
-- needed here, unlike assign_group_id/is_space_member which exist to
-- solve RLS recursion for the browser client instead).
--
-- min(actor_user_id) below is cast through text and back - Postgres has
-- no min() aggregate defined for uuid at all (confirmed live: 42883
-- "function min(uuid) does not exist"), so the aggregate has to run over
-- the text representation instead.
-- ---------------------------------------------------------------------

create or replace function public.get_daily_brief_activity(p_user_id uuid, p_since timestamptz)
returns table (
  space_id uuid,
  space_name text,
  space_icon text,
  space_color text,
  activity jsonb,
  sole_actor_name text
)
language sql
stable
set search_path = public
as $$
  with my_spaces as (
    select s.id, s.name, s.icon, s.color
    from spaces s
    where public.is_space_member(s.id, p_user_id)
  ),
  events as (
    select
      ms.id as space_id,
      c.user_id as actor_user_id,
      case when c.created_at > p_since then 'added' else 'edited' end as activity_type
    from captures c
    join my_spaces ms on ms.id::text = any(c.space_ids)
    where c.source = 'user'
      and c.archived_at is null
      and c.user_id <> p_user_id
      and (c.created_at > p_since or c.updated_at > p_since)
  ),
  per_space_type as (
    select space_id, activity_type, count(*)::int as cnt
    from events
    group by space_id, activity_type
  ),
  per_space_activity as (
    select
      space_id,
      jsonb_agg(jsonb_build_object('type', activity_type, 'count', cnt) order by activity_type) as activity
    from per_space_type
    group by space_id
  ),
  per_space_actor as (
    select
      space_id,
      case when count(*) = 1 then min(actor_user_id::text)::uuid end as sole_actor_id
    from events
    group by space_id
  )
  select
    ms.id as space_id,
    ms.name as space_name,
    ms.icon as space_icon,
    ms.color as space_color,
    psa.activity,
    p.display_name as sole_actor_name
  from my_spaces ms
  join per_space_activity psa on psa.space_id = ms.id
  left join per_space_actor pact on pact.space_id = ms.id
  left join profiles p on p.id = pact.sole_actor_id
  order by ms.name;
$$;

grant execute on function public.get_daily_brief_activity(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- user_preferences - rename the enable/disable toggle, drop the quote
-- sub-toggle entirely (there's no quote in the Daily Brief). Postgres has
-- no RENAME COLUMN IF EXISTS clause, so the rename is guarded by an
-- explicit existence check instead; DROP COLUMN does support IF EXISTS
-- directly.
-- ---------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_preferences' and column_name = 'morning_brief_enabled'
  ) then
    alter table user_preferences rename column morning_brief_enabled to daily_brief_enabled;
  end if;
end $$;

alter table user_preferences drop column if exists morning_brief_quote_enabled;
