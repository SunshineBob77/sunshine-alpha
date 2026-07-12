-- System Drops v1 — Morning Brief
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.

alter table captures
  add column source text not null default 'user' check (source in ('user', 'system')),
  add column system_drop_type text,
  add column generated_for_date date,
  add column archived_at timestamptz;

-- Enforces idempotency at the DB level (not just app-side check-then-insert),
-- so rapid repeated opens / concurrent tabs can't create duplicate briefs.
create unique index captures_system_morning_brief_unique
  on captures (user_id, generated_for_date)
  where source = 'system' and system_drop_type = 'morning_brief';

create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_brief_enabled boolean not null default true,
  morning_brief_quote_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "Users can read their own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

-- Manually-created tables don't inherit the default grants Supabase's own
-- tooling applies automatically - without these, both the service_role API
-- route and the authenticated browser client get "permission denied" even
-- though RLS policies above are otherwise correct.
grant select, insert, update, delete on public.user_preferences to service_role;
grant select, insert, update on public.user_preferences to authenticated;

-- service_role has always had UPDATE on captures (analyze-drop uses it),
-- but never INSERT - every prior insert path went through the
-- authenticated browser client. System Drop generation is the first
-- server-side insert into captures, and exposed this latent gap.
grant insert on public.captures to service_role;
