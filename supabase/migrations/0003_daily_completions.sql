-- MINES · Daily challenge
-- One row per (user, UTC date). Primary key enforces "one attempt per day,
-- win or lose" — the page-level check on this row gates retries.

create table if not exists public.daily_completions (
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,                 -- UTC calendar day
  seed         bigint not null,               -- deterministic seed used
  won          boolean not null,
  elapsed_ms   int not null,
  opens        int not null,
  clicks       int not null,
  flagged      int not null,
  boom_r       int,
  boom_c       int,
  played_at    timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists daily_completions_date_idx
  on public.daily_completions (date desc);

alter table public.daily_completions enable row level security;

drop policy if exists daily_completions_self_rw on public.daily_completions;
create policy daily_completions_self_rw on public.daily_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
