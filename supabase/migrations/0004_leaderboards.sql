-- MINES · Leaderboards
-- 1) Adds a country code to profiles for regional filtering.
-- 2) Opens SELECT on profiles + daily_completions so any signed-in user can
--    read the public leaderboard fields (username, country, win stats, etc.).
--    Writes stay locked to the row owner via auth.uid() = id checks.

alter table public.profiles
  add column if not exists country text;

-- Lightweight format guard: ISO 3166-1 alpha-2 (e.g. US, GB, DE) or NULL.
alter table public.profiles
  drop constraint if exists profiles_country_iso2_check;
alter table public.profiles
  add constraint profiles_country_iso2_check
  check (country is null or country ~ '^[A-Z]{2}$');

-- ----- profiles RLS: split read (public) from write (self) ---------------
drop policy if exists profiles_self_rw on public.profiles;
drop policy if exists profiles_public_read on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_self_delete on public.profiles;

create policy profiles_public_read on public.profiles
  for select using (true);

create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy profiles_self_delete on public.profiles
  for delete using (auth.uid() = id);

-- ----- daily_completions RLS: open SELECT for leaderboard --------------
drop policy if exists daily_completions_self_rw on public.daily_completions;
drop policy if exists daily_completions_public_read on public.daily_completions;
drop policy if exists daily_completions_self_insert on public.daily_completions;
drop policy if exists daily_completions_self_update on public.daily_completions;
drop policy if exists daily_completions_self_delete on public.daily_completions;

create policy daily_completions_public_read on public.daily_completions
  for select using (true);

create policy daily_completions_self_insert on public.daily_completions
  for insert with check (auth.uid() = user_id);

create policy daily_completions_self_update on public.daily_completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy daily_completions_self_delete on public.daily_completions
  for delete using (auth.uid() = user_id);

-- Index for "fastest today" queries.
create index if not exists daily_completions_date_won_time_idx
  on public.daily_completions (date, won, elapsed_ms)
  where won = true;

-- Index for region filtering on profiles.
create index if not exists profiles_country_idx
  on public.profiles (country)
  where country is not null;
