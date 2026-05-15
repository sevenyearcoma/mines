-- One active solo board per user and difficulty. The JSON state is owned by
-- the web client because Phaser owns the live board engine.

create table if not exists public.solo_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('beginner','intermediate','expert')),
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, difficulty)
);

create index if not exists solo_progress_user_updated_idx
  on public.solo_progress (user_id, updated_at desc);

alter table public.solo_progress enable row level security;

drop policy if exists solo_progress_self_select on public.solo_progress;
drop policy if exists solo_progress_self_insert on public.solo_progress;
drop policy if exists solo_progress_self_update on public.solo_progress;
drop policy if exists solo_progress_self_delete on public.solo_progress;

create policy solo_progress_self_select on public.solo_progress
  for select using (auth.uid() = user_id);

create policy solo_progress_self_insert on public.solo_progress
  for insert with check (auth.uid() = user_id);

create policy solo_progress_self_update on public.solo_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy solo_progress_self_delete on public.solo_progress
  for delete using (auth.uid() = user_id);
