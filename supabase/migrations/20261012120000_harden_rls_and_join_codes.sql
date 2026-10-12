-- Tighten access found in the October 2026 review.

-- 1. Ballots and voting rounds are only ever written through submit_ballot and
--    start_voting_session, which validate them. These direct-insert policies
--    let a client skip that validation (e.g. rank books that aren't in the
--    round, inflating the ballot count a majority is measured against, or open
--    a round with fewer than two books).
drop policy if exists votes_insert_own on public.votes;
drop policy if exists rankings_insert_own on public.vote_rankings;
drop policy if exists sessions_insert_owner on public.voting_sessions;
drop policy if exists session_books_insert on public.voting_session_books;

-- 2. Supabase grants EXECUTE on new functions to anon and authenticated
--    directly, so the earlier `revoke ... from public` left them callable
--    signed-out. Each one rejects a null auth.uid(), but signed-out callers
--    have no reason to reach them at all.
revoke execute on function public.create_club(text) from anon, public;
revoke execute on function public.join_club(text) from anon, public;
revoke execute on function public.start_voting_session(uuid) from anon, public;
revoke execute on function public.submit_ballot(uuid, uuid[]) from anon, public;
revoke execute on function public.close_voting_session(uuid) from anon, public;
-- RLS policies call these as the signed-in user, so authenticated keeps them.
revoke execute on function public.is_club_member(uuid) from anon, public;
revoke execute on function public.is_club_owner(uuid) from anon, public;
-- Only ever fired by the auth.users trigger.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. The organizer can't leave their own club (it would leave the club with an
--    owner who can't see its members). They can still remove other members,
--    and anyone else can still leave.
drop policy if exists club_members_delete on public.club_members;
create policy club_members_delete on public.club_members for delete to authenticated
  using (
    (user_id = auth.uid() and not public.is_club_owner(club_id))
    or (user_id <> auth.uid() and public.is_club_owner(club_id))
  );

-- 4. Join codes were 6 hex characters (~16.7M possibilities) with no limit on
--    guesses. New clubs get 10 characters from a 32-letter alphabet that skips
--    look-alikes (0/O, 1/I), ~10^15 possibilities. Existing codes keep working
--    because people have already shared them, so guesses are also rate limited.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- gen_random_uuid() is version 4: bytes 6 and 8 carry fixed version and
  -- variant bits, so draw only from the fully random bytes. 256 is a multiple
  -- of 32, so taking each byte mod 32 is unbiased.
  v_positions constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11];
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
  v_position int;
begin
  foreach v_position in array v_positions loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_position) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.generate_join_code() from anon, authenticated, public;

create or replace function public.create_club(p_name text)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club public.clubs;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'club name required';
  end if;

  loop
    v_code := public.generate_join_code();
    exit when not exists (select 1 from public.clubs c where c.join_code = v_code);
  end loop;

  insert into public.clubs (name, owner_id, join_code)
  values (left(trim(p_name), 80), auth.uid(), v_code)
  returning * into v_club;

  insert into public.club_members (club_id, user_id) values (v_club.id, auth.uid());

  return v_club;
end;
$$;

-- Failed join attempts, read and written only by join_club (RLS on, no policies).
create table if not exists public.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time_idx on public.join_attempts(user_id, attempted_at);
alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from anon, authenticated;

-- An unknown code now returns null instead of raising, because raising would
-- roll back the attempt being recorded.
create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if (
    select count(*) from public.join_attempts a
    where a.user_id = auth.uid() and a.attempted_at > now() - interval '15 minutes'
  ) >= 10 then
    raise exception 'too_many_attempts';
  end if;

  select c.id into v_club_id from public.clubs c
  where c.join_code = upper(trim(p_code));

  if v_club_id is null then
    delete from public.join_attempts a
    where a.user_id = auth.uid() and a.attempted_at < now() - interval '1 day';
    insert into public.join_attempts (user_id) values (auth.uid());
    return null;
  end if;

  insert into public.club_members (club_id, user_id)
  values (v_club_id, auth.uid())
  on conflict do nothing;

  return v_club_id;
end;
$$;

-- create or replace keeps existing grants; restate them so this file stands alone.
revoke execute on function public.create_club(text) from anon, public;
revoke execute on function public.join_club(text) from anon, public;
grant execute on function public.create_club(text) to authenticated;
grant execute on function public.join_club(text) to authenticated;
