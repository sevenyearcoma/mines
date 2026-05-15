-- MINES · Phase 4 triggers
-- 1) auto-create a profile row when a new auth.users row appears
-- 2) update profile aggregates after every games insert

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',        -- GitHub handle
      new.raw_user_meta_data->>'preferred_username', -- OAuth fallback
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'player'
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_game_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  best_col text := 'best_time_' || new.difficulty || '_ms';
  new_streak int;
begin
  update public.profiles
     set games_played   = games_played + 1,
         games_won      = games_won + (case when new.won then 1 else 0 end),
         current_streak = case when new.won then current_streak + 1 else 0 end
   where id = new.user_id
   returning current_streak into new_streak;

  update public.profiles
     set best_streak = greatest(best_streak, new_streak)
   where id = new.user_id;

  if new.won then
    execute format(
      'update public.profiles set %I = least(coalesce(%I, $1), $1) where id = $2',
      best_col, best_col
    ) using new.elapsed_ms, new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_games_insert on public.games;
create trigger on_games_insert
  after insert on public.games
  for each row execute function public.apply_game_to_profile();
