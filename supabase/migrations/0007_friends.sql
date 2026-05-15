-- MINES · Friends
-- Single-row-per-relationship model: (user_a, user_b) with user_a < user_b
-- enforced by check constraint. `requested_by` records who initiated; the
-- other party flips status to 'accepted'.

create table if not exists public.friendships (
  user_a       uuid not null,
  user_b       uuid not null,
  status       text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b)),
  -- Named FKs so PostgREST's `profiles!friendships_user_a_fkey(...)` hint
  -- resolves unambiguously when both user_a and user_b embed profiles.
  constraint friendships_user_a_fkey foreign key (user_a)
    references public.profiles(id) on delete cascade,
  constraint friendships_user_b_fkey foreign key (user_b)
    references public.profiles(id) on delete cascade,
  constraint friendships_requested_by_fkey foreign key (requested_by)
    references public.profiles(id) on delete cascade
);

create index if not exists friendships_user_a_idx on public.friendships (user_a);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;

drop policy if exists friendships_party_select   on public.friendships;
drop policy if exists friendships_party_insert   on public.friendships;
drop policy if exists friendships_party_update   on public.friendships;
drop policy if exists friendships_party_delete   on public.friendships;

-- Either side can read the row. The world cannot.
create policy friendships_party_select on public.friendships
  for select using (auth.uid() in (user_a, user_b));

-- Insert: requester must be one of the parties AND be the one named in
-- `requested_by` (prevents A from inserting a "pending from B to A" row).
create policy friendships_party_insert on public.friendships
  for insert with check (
    auth.uid() in (user_a, user_b)
    and auth.uid() = requested_by
  );

-- Update: either party can move 'pending' → 'accepted'. The acceptance can
-- only come from the OTHER party (not the original requester).
create policy friendships_party_update on public.friendships
  for update using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

-- Delete: either party can unfriend / cancel a pending request.
create policy friendships_party_delete on public.friendships
  for delete using (auth.uid() in (user_a, user_b));
