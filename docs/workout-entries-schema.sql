-- workout_entries — retroactive documentation + RLS lockdown.
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- This table already exists live and has been written to since the
-- WORKOUT extraction task landed in analyze-drop/route.ts (see its
-- upsert/delete calls around line ~659) - it just never got a schema doc
-- of its own, unlike every other table in this codebase. Reconstructed
-- here from that write path (the only place this table is referenced
-- anywhere in the app - nothing has ever read it), not from a live
-- pg_dump. If the actual live column types differ subtly from what's
-- below, that's fine: CREATE TABLE IF NOT EXISTS silently no-ops against
-- an already-existing table (Postgres doesn't diff/alter existing columns
-- to match), so this is documentation with a safety net, not a live
-- migration of the table's shape. The genuinely new, load-bearing part of
-- this file is the RLS section below.
--
-- Confirmed live (2026-07-18): `select * from pg_policies where
-- tablename = 'workout_entries'` returned zero rows - RLS was never
-- enabled on this table at all. Any role holding a table-level grant on
-- it currently sees every user's workout data, not just their own. This
-- is being fixed here regardless of Ask Sunshine v2 - it's a real gap on
-- its own, not something v2 introduces.
--
-- Enabling RLS is safe for the existing write path: analyze-drop/route.ts
-- upserts/deletes via supabaseAdmin (service_role), which always bypasses
-- RLS entirely regardless of whether it's enabled or what policies
-- exist - nothing about today's capture-save flow changes by turning
-- this on.

create table if not exists workout_entries (
  -- 1:1 with captures - analyze-drop/route.ts upserts with
  -- onConflict: "capture_id", which requires capture_id to already be
  -- unique in the live table. Making it the primary key directly here
  -- (rather than a separate surrogate id) matches that 1:1 relationship
  -- exactly, and is the simplest shape consistent with the observed
  -- upsert behavior - if the live table actually uses a separate
  -- surrogate id instead, this clause is a no-op either way (see header).
  capture_id bigint primary key references captures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Free-text AI extraction (analyze-drop/route.ts's WORKOUT task), not a
  -- fixed enum - "boxing", "running", "weightlifting", whatever the model
  -- wrote for that Drop. Ask Sunshine v2's activity query needs
  -- ilike/substring matching against this, never exact equality.
  activity_type text not null,
  rounds integer,
  -- numeric, not integer - the AI extraction type (WorkoutExtraction in
  -- analyze-drop/route.ts) is a bare `number` for both duration fields,
  -- which could plausibly be fractional (e.g. 2.5-minute rounds).
  round_length_minutes numeric,
  total_duration_minutes numeric,
  notes text,
  date date not null,
  created_at timestamptz not null default now()
);

-- Supports Ask Sunshine v2's query shape (own rows, optional activity_type
-- filter, date range) without a sequential scan as this table grows.
create index if not exists workout_entries_user_date_idx
  on workout_entries (user_id, date);

alter table workout_entries enable row level security;

create policy "Users can view their own workout entries"
  on workout_entries for select
  using (auth.uid() = user_id);

-- Deliberately no INSERT/UPDATE/DELETE policy, and no grant to
-- `authenticated` at all (not even SELECT) - every current write path
-- (analyze-drop/route.ts) and every planned read path (Ask Sunshine v2's
-- new server route) goes through supabaseAdmin (service_role, which
-- bypasses RLS and already has whatever grants it needs - proven by the
-- existing upserts already working in production), so there's no reason
-- to also open this table to the browser client. The SELECT policy above
-- exists as defense-in-depth for if that ever changes, not because
-- anything today relies on it.
