-- MINES · Demos (pro)
-- Save the action log alongside each finished game so it can be replayed
-- like a CS2 demo. Opens SELECT on games to match the daily/profiles model
-- so cross-user demo viewing works.

-- 1. Action logs on both finishable game types ----------------------------
alter table public.games
  add column if not exists actions jsonb;

alter table public.daily_completions
  add column if not exists actions jsonb;

-- 2. Stable surface id for daily_completions ------------------------------
-- The composite PK (user_id, date) isn't URL-friendly; add an opaque uuid
-- so /demo/daily/<id> works the same as /demo/solo/<id>.
alter table public.daily_completions
  add column if not exists id uuid;
update public.daily_completions
  set id = gen_random_uuid()
  where id is null;
alter table public.daily_completions
  alter column id set default gen_random_uuid();
alter table public.daily_completions
  alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_completions_id_key'
  ) then
    alter table public.daily_completions
      add constraint daily_completions_id_key unique (id);
  end if;
end $$;

-- 3. Pre-plant anchor for daily games -------------------------------------
-- Solo games plant at the first reveal action; daily games auto-plant at
-- a fixed cell before any input is logged. Storing it explicitly means the
-- demo player can reconstruct state without re-deriving it from the date.
alter table public.daily_completions
  add column if not exists pre_plant_r int;
alter table public.daily_completions
  add column if not exists pre_plant_c int;

-- 4. games RLS: public read, self write -----------------------------------
drop policy if exists games_self_rw on public.games;
drop policy if exists games_public_read on public.games;
drop policy if exists games_self_insert on public.games;
drop policy if exists games_self_update on public.games;
drop policy if exists games_self_delete on public.games;

create policy games_public_read on public.games
  for select using (true);

create policy games_self_insert on public.games
  for insert with check (auth.uid() = user_id);

create policy games_self_update on public.games
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy games_self_delete on public.games
  for delete using (auth.uid() = user_id);

-- 5. Indexes for demo browsing --------------------------------------------
create index if not exists games_won_recent_idx
  on public.games (won, played_at desc)
  where actions is not null;

create index if not exists daily_completions_won_recent_idx
  on public.daily_completions (date desc, won, elapsed_ms)
  where actions is not null;
