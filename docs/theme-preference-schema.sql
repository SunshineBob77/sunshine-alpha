-- Unified light/dark theme v1 - theme_preference
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - Defaults to 'dark', matching both the app's current forced-dark
--   Lifeline behavior and globals.css's own default token values
--   (:root/no data-theme attribute resolves dark) - a fresh row and an
--   unauthenticated/pre-load render always agree, no flash-to-light.
-- - No prior client-side UPDATE path existed on profiles at all (the one
--   existing write - last_visited_at - is service-role-only, from
--   app/api/daily-brief/route.ts). This is the first field a user needs
--   to write to their own profile directly from the browser, so a
--   self-scoped UPDATE policy is added here - it's not assumed to
--   already exist. If a policy with this exact name already exists on
--   your profiles table, rename one side before running.

alter table profiles
  add column theme_preference text not null default 'dark'
    check (theme_preference in ('light', 'dark'));

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
