-- MINES · Leaderboard relationships
-- Re-target user_id FKs from auth.users → public.profiles so PostgREST can
-- resolve embed/join syntax used by the leaderboard queries
-- (`profiles!inner(username, country)`). Cascade-on-user-deletion is
-- preserved because profiles.id itself references auth.users(id) ON DELETE
-- CASCADE (see 0001_init.sql), so a deleted auth user still walks the chain
-- profiles → daily_completions / games.

alter table public.daily_completions
  drop constraint if exists daily_completions_user_id_fkey;
alter table public.daily_completions
  add constraint daily_completions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.games
  drop constraint if exists games_user_id_fkey;
alter table public.games
  add constraint games_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
