-- MINES - PvP round demos
-- Stores one replay row per finished 1x1 round. The id is deterministic:
-- <match_id>-<round_index>, so either client can upsert the same replay.

create table if not exists public.match_round_demos (
  id text primary key,
  match_id text not null,
  round_index int not null,
  rows int not null,
  cols int not null,
  mines int not null,
  seed bigint not null,
  time_limit_ms int,
  pre_plant_r int,
  pre_plant_c int,
  winner_index int check (winner_index in (0, 1)),
  player0_id uuid not null,
  player1_id uuid not null,
  player0_reason text not null check (player0_reason in ('won', 'exploded', 'timeout')),
  player0_elapsed_ms int not null,
  player0_opens int not null,
  player0_clicks int not null,
  player0_flagged int not null,
  player0_score int not null,
  player0_mistakes int not null default 0,
  player0_actions jsonb not null default '[]'::jsonb,
  player1_reason text not null check (player1_reason in ('won', 'exploded', 'timeout')),
  player1_elapsed_ms int not null,
  player1_opens int not null,
  player1_clicks int not null,
  player1_flagged int not null,
  player1_score int not null,
  player1_mistakes int not null default 0,
  player1_actions jsonb not null default '[]'::jsonb,
  played_at timestamptz not null default now(),
  constraint match_round_demos_player0_id_fkey foreign key (player0_id)
    references public.profiles(id) on delete cascade,
  constraint match_round_demos_player1_id_fkey foreign key (player1_id)
    references public.profiles(id) on delete cascade,
  constraint match_round_demos_players_distinct_check check (player0_id <> player1_id),
  constraint match_round_demos_round_unique unique (match_id, round_index)
);

create index if not exists match_round_demos_recent_idx
  on public.match_round_demos (played_at desc);

create index if not exists match_round_demos_player0_idx
  on public.match_round_demos (player0_id, played_at desc);

create index if not exists match_round_demos_player1_idx
  on public.match_round_demos (player1_id, played_at desc);

alter table public.match_round_demos enable row level security;

drop policy if exists match_round_demos_public_read on public.match_round_demos;
drop policy if exists match_round_demos_participant_insert on public.match_round_demos;
drop policy if exists match_round_demos_participant_update on public.match_round_demos;

create policy match_round_demos_public_read on public.match_round_demos
  for select using (true);

create policy match_round_demos_participant_insert on public.match_round_demos
  for insert with check (auth.uid() in (player0_id, player1_id));

create policy match_round_demos_participant_update on public.match_round_demos
  for update using (auth.uid() in (player0_id, player1_id))
  with check (auth.uid() in (player0_id, player1_id));
