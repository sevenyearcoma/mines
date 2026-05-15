-- MINES · Phase 4 schema
-- Tables: profiles (1:1 with auth.users) + games (one row per finished game)
-- RLS: users can only read/write their own data.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  games_played int not null default 0,
  games_won int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  best_time_beginner_ms int,
  best_time_intermediate_ms int,
  best_time_expert_ms int
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('beginner','intermediate','expert')),
  seed bigint not null,
  won boolean not null,
  elapsed_ms int not null,
  opens int not null,
  clicks int not null,
  flagged int not null,
  post_loss_hint_count int not null default 0,
  boom_r int,
  boom_c int,
  played_at timestamptz not null default now()
);

create index if not exists games_user_played_idx
  on public.games (user_id, played_at desc);

alter table public.profiles enable row level security;
alter table public.games    enable row level security;

drop policy if exists profiles_self_rw on public.profiles;
create policy profiles_self_rw on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists games_self_rw on public.games;
create policy games_self_rw on public.games
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
