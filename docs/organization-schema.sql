-- Spaces -> Organization: rename overrides
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
-- Ordering (pinned-first, then recency) needs no schema change - it reuses
-- the existing captures.pinned field and captures.created_at, computed
-- client-side.

create table user_space_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id text not null,
  custom_name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, space_id)
);

alter table user_space_overrides enable row level security;

create policy "Users can read their own space overrides"
  on user_space_overrides for select
  using (auth.uid() = user_id);

create policy "Users can insert their own space overrides"
  on user_space_overrides for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own space overrides"
  on user_space_overrides for update
  using (auth.uid() = user_id);

create policy "Users can delete their own space overrides"
  on user_space_overrides for delete
  using (auth.uid() = user_id);

-- Learned twice this session: manually-created tables don't inherit
-- Supabase's automatic default grants - granting both roles up front
-- this time instead of discovering the gap via a failed request.
grant select, insert, update, delete on public.user_space_overrides to service_role;
grant select, insert, update, delete on public.user_space_overrides to authenticated;
