-- Reads: each book a club picks gets its own read, with its own nomination
-- list, vote, optional dates, and member ratings. Lifecycle:
--
--   nominating -> voting -> up_next -> current -> finished
--
-- A club has at most one current read and at most one next read (nominating,
-- voting, or up_next) at a time, so the next pick can happen while the club
-- is still reading the current one. A vote that finishes while another read
-- is current waits as up_next until the organizer marks the current one
-- finished.

create table public.reads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  number int not null check (number >= 1),
  status text not null default 'nominating'
    check (status in ('nominating', 'voting', 'up_next', 'current', 'finished')),
  book_id uuid references public.books(id) on delete set null,
  start_date date,
  discussion_date date,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (club_id, number),
  check (start_date is null or discussion_date is null or discussion_date >= start_date)
);
create unique index one_current_read_per_club on public.reads(club_id) where status = 'current';
create unique index one_next_read_per_club on public.reads(club_id)
  where status in ('nominating', 'voting', 'up_next');

alter table public.reads enable row level security;
-- Members read; every write goes through the functions below.
create policy reads_select on public.reads for select to authenticated
  using (public.is_club_member(club_id));

alter table public.clubs
  add column max_nominations_per_member smallint not null default 3
  check (max_nominations_per_member between 1 and 10);

-- Nominations and votes belong to a read. A book can be nominated again in a
-- later read, so uniqueness moves from (club, book) to (read, book).
alter table public.club_candidate_books
  add column read_id uuid references public.reads(id) on delete cascade;
alter table public.club_candidate_books
  drop constraint club_candidate_books_club_id_book_id_key;

alter table public.voting_sessions
  add column read_id uuid unique references public.reads(id) on delete cascade;

-- Ratings from 0.5 to 10 in half points, stored as a count of half points so
-- there's no float rounding.
create table public.read_ratings (
  read_id uuid not null references public.reads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_halves smallint not null check (score_halves between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (read_id, user_id)
);

alter table public.read_ratings enable row level security;
create policy read_ratings_select on public.read_ratings for select to authenticated
  using (exists (
    select 1 from public.reads r where r.id = read_id and public.is_club_member(r.club_id)
  ));
-- Members rate once the organizer marks the read finished, and can change
-- their rating afterwards.
create policy read_ratings_insert on public.read_ratings for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reads r
      where r.id = read_id and r.status = 'finished' and public.is_club_member(r.club_id)
    )
  );
create policy read_ratings_update on public.read_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reads r
      where r.id = read_id and r.status = 'finished' and public.is_club_member(r.club_id)
    )
  );
create policy read_ratings_delete on public.read_ratings for delete to authenticated
  using (user_id = auth.uid());

-- Convert existing history. Each past vote becomes a read, numbered in order;
-- the vote that picked the club's current book becomes the current read, and
-- earlier ones are finished. Past reads get a copy of their ballot as their
-- nomination list. Any remaining shortlist moves to the open vote's read, or
-- to a new nominating read (minus books that have already won).
do $$
declare
  v_club record;
  v_session record;
  v_number int;
  v_read uuid;
  v_latest_completed uuid;
  v_status text;
begin
  for v_club in select c.id, c.owner_id, c.current_book_id from public.clubs c loop
    v_number := 0;

    select s.id into v_latest_completed from public.voting_sessions s
    where s.club_id = v_club.id and s.status = 'completed'
    order by s.started_at desc limit 1;

    for v_session in
      select s.* from public.voting_sessions s where s.club_id = v_club.id order by s.started_at
    loop
      v_number := v_number + 1;
      v_status := case
        when v_session.status = 'active' then 'voting'
        when v_session.id = v_latest_completed
          and v_session.winning_book_id is not distinct from v_club.current_book_id then 'current'
        else 'finished'
      end;

      insert into public.reads (club_id, number, status, book_id, created_at, finished_at)
      values (
        v_club.id, v_number, v_status, v_session.winning_book_id, v_session.started_at,
        case when v_status = 'finished' then v_session.ended_at end
      )
      returning id into v_read;

      update public.voting_sessions set read_id = v_read where id = v_session.id;

      if v_session.status = 'completed' then
        insert into public.club_candidate_books (club_id, book_id, added_by, added_at, read_id)
        select
          v_club.id,
          sb.book_id,
          coalesce(
            (select cb.added_by from public.club_candidate_books cb
             where cb.club_id = v_club.id and cb.book_id = sb.book_id and cb.read_id is null
             limit 1),
            v_club.owner_id
          ),
          coalesce(
            (select cb.added_at from public.club_candidate_books cb
             where cb.club_id = v_club.id and cb.book_id = sb.book_id and cb.read_id is null
             limit 1),
            v_session.started_at
          ),
          v_read
        from public.voting_session_books sb
        where sb.voting_session_id = v_session.id;
      end if;
    end loop;

    if exists (
      select 1 from public.club_candidate_books cb where cb.club_id = v_club.id and cb.read_id is null
    ) then
      select r.id into v_read from public.reads r where r.club_id = v_club.id and r.status = 'voting';

      if v_read is null then
        v_number := v_number + 1;
        insert into public.reads (club_id, number, status)
        values (v_club.id, v_number, 'nominating')
        returning id into v_read;

        delete from public.club_candidate_books cb
        where cb.club_id = v_club.id and cb.read_id is null
          and cb.book_id in (
            select r.book_id from public.reads r where r.club_id = v_club.id and r.book_id is not null
          );
      end if;

      update public.club_candidate_books set read_id = v_read
      where club_id = v_club.id and read_id is null;
    end if;
  end loop;
end;
$$;

alter table public.club_candidate_books alter column read_id set not null;
alter table public.club_candidate_books
  add constraint club_candidate_books_read_id_book_id_key unique (read_id, book_id);
alter table public.voting_sessions alter column read_id set not null;

-- New nominations go to the club's next read. If there isn't one, a member's
-- first nomination opens it (with no dates, which the organizer can add
-- later). Nominations close once voting starts, and each member is capped per
-- read. Raising here gives the app specific errors instead of a generic RLS
-- failure; candidates_insert still checks membership and authorship.
create or replace function public.assign_nomination_read()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club_id uuid;
  v_limit smallint;
begin
  if new.read_id is null then
    select r.id into new.read_id from public.reads r
    where r.club_id = new.club_id and r.status in ('nominating', 'voting', 'up_next');

    if new.read_id is null then
      insert into public.reads (club_id, number)
      values (
        new.club_id,
        coalesce((select max(r.number) from public.reads r where r.club_id = new.club_id), 0) + 1
      )
      returning id into new.read_id;
    end if;
  end if;

  select r.status, r.club_id into v_status, v_club_id from public.reads r where r.id = new.read_id;
  if v_club_id is distinct from new.club_id then
    raise exception 'read_not_in_club';
  end if;
  if v_status <> 'nominating' then
    raise exception 'nominations_closed';
  end if;

  select c.max_nominations_per_member into v_limit from public.clubs c where c.id = new.club_id;
  if (
    select count(*) from public.club_candidate_books cb
    where cb.read_id = new.read_id and cb.added_by = new.added_by
  ) >= v_limit then
    raise exception 'nomination_limit_reached';
  end if;

  return new;
end;
$$;

revoke execute on function public.assign_nomination_read() from anon, authenticated, public;

create trigger assign_nomination_read
  before insert on public.club_candidate_books
  for each row execute function public.assign_nomination_read();

create index club_candidate_books_read_idx on public.club_candidate_books(read_id);

-- Nominations can only be withdrawn while the read is still taking them;
-- after that they're part of the vote and the read's history.
drop policy if exists candidates_delete on public.club_candidate_books;
create policy candidates_delete on public.club_candidate_books for delete to authenticated
  using (
    public.is_club_member(club_id)
    and (added_by = auth.uid() or public.is_club_owner(club_id))
    and exists (select 1 from public.reads r where r.id = read_id and r.status = 'nominating')
  );

-- Organizer: open the next read, optionally with dates.
create or replace function public.start_next_read(
  p_club_id uuid,
  p_start_date date default null,
  p_discussion_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_read_id uuid;
begin
  if not public.is_club_owner(p_club_id) then
    raise exception 'not_club_owner';
  end if;
  if exists (
    select 1 from public.reads r
    where r.club_id = p_club_id and r.status in ('nominating', 'voting', 'up_next')
  ) then
    raise exception 'next_read_already_open';
  end if;
  if p_start_date is not null and p_discussion_date is not null and p_discussion_date < p_start_date then
    raise exception 'discussion_before_start';
  end if;

  insert into public.reads (club_id, number, start_date, discussion_date)
  values (
    p_club_id,
    coalesce((select max(r.number) from public.reads r where r.club_id = p_club_id), 0) + 1,
    p_start_date,
    p_discussion_date
  )
  returning id into v_read_id;

  return v_read_id;
end;
$$;

-- Organizer: set or change a read's dates at any stage.
create or replace function public.update_read_dates(
  p_read_id uuid,
  p_start_date date,
  p_discussion_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
begin
  select r.club_id into v_club_id from public.reads r where r.id = p_read_id;
  if v_club_id is null then
    raise exception 'read_not_found';
  end if;
  if not public.is_club_owner(v_club_id) then
    raise exception 'not_club_owner';
  end if;
  if p_start_date is not null and p_discussion_date is not null and p_discussion_date < p_start_date then
    raise exception 'discussion_before_start';
  end if;

  update public.reads set start_date = p_start_date, discussion_date = p_discussion_date
  where id = p_read_id;
end;
$$;

-- Organizer: mark the current read finished. Ratings open, and a book waiting
-- as up_next becomes the current read.
create or replace function public.finish_read(p_read_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_next_book uuid;
begin
  select r.club_id, r.status into v_club_id, v_status from public.reads r where r.id = p_read_id;
  if v_club_id is null then
    raise exception 'read_not_found';
  end if;
  if not public.is_club_owner(v_club_id) then
    raise exception 'not_club_owner';
  end if;
  if v_status <> 'current' then
    raise exception 'read_not_current';
  end if;

  update public.reads set status = 'finished', finished_at = now() where id = p_read_id;

  update public.reads set status = 'current'
  where club_id = v_club_id and status = 'up_next'
  returning book_id into v_next_book;

  update public.clubs set current_book_id = v_next_book where id = v_club_id;
end;
$$;

-- Organizer: undo an accidental "finished", as long as no other read has
-- become current since.
create or replace function public.reopen_read(p_read_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_book_id uuid;
begin
  select r.club_id, r.status, r.book_id into v_club_id, v_status, v_book_id
  from public.reads r where r.id = p_read_id;
  if v_club_id is null then
    raise exception 'read_not_found';
  end if;
  if not public.is_club_owner(v_club_id) then
    raise exception 'not_club_owner';
  end if;
  if v_status <> 'finished'
    or exists (select 1 from public.reads r where r.club_id = v_club_id and r.status = 'current')
    or exists (
      select 1 from public.reads r
      where r.club_id = v_club_id and r.status = 'finished' and r.finished_at > (
        select r2.finished_at from public.reads r2 where r2.id = p_read_id
      )
    )
  then
    raise exception 'cannot_reopen';
  end if;

  update public.reads set status = 'current', finished_at = null where id = p_read_id;
  update public.clubs set current_book_id = v_book_id where id = v_club_id;
end;
$$;

-- Voting now runs on the club's nominating read.
create or replace function public.start_voting_session(p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_read_id uuid;
  v_count int;
begin
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
    raise exception 'not_club_owner';
  end if;

  if exists (select 1 from public.voting_sessions s where s.club_id = p_club_id and s.status = 'active') then
    raise exception 'session_already_active';
  end if;

  select r.id into v_read_id from public.reads r
  where r.club_id = p_club_id and r.status = 'nominating';

  select count(*) into v_count from public.club_candidate_books b where b.read_id = v_read_id;
  if v_read_id is null or v_count < 2 then
    raise exception 'need_two_candidates';
  end if;

  insert into public.voting_sessions (club_id, read_id)
  values (p_club_id, v_read_id)
  returning id into v_session_id;

  insert into public.voting_session_books (voting_session_id, book_id)
  select v_session_id, b.book_id from public.club_candidate_books b where b.read_id = v_read_id;

  update public.reads set status = 'voting' where id = v_read_id;

  return v_session_id;
end;
$$;

-- Same instant-runoff tally as before. The winner becomes the current read, or
-- waits as up_next if the club is still reading something.
create or replace function public.close_voting_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_club_id uuid;
  v_read_id uuid;
  v_status text;
  v_eliminated uuid[] := '{}';
  v_remaining int;
  v_total_ballots int;
  v_round int := 0;
  v_rounds jsonb := '[]'::jsonb;
  v_round_counts jsonb;
  v_leader uuid;
  v_leader_votes int;
  v_active_ballots int;
  v_loser uuid;
  v_winner uuid;
  v_results jsonb;
begin
  select s.club_id, s.read_id, s.status into v_club_id, v_read_id, v_status
  from public.voting_sessions s where s.id = p_session_id;

  if v_club_id is null then raise exception 'session_not_found'; end if;
  if not exists (select 1 from public.clubs c where c.id = v_club_id and c.owner_id = auth.uid()) then
    raise exception 'not_club_owner';
  end if;
  if v_status <> 'active' then raise exception 'session_not_active'; end if;

  select count(*) into v_total_ballots from public.votes v where v.voting_session_id = p_session_id;
  if v_total_ballots = 0 then raise exception 'no_ballots'; end if;

  loop
    v_round := v_round + 1;

    -- Current top choice per ballot among books still in the running.
    with active as (
      select v.id as vote_id,
             (select r.book_id from public.vote_rankings r
               where r.vote_id = v.id and not (r.book_id = any(v_eliminated))
               order by r.rank asc limit 1) as choice
      from public.votes v
      where v.voting_session_id = p_session_id
    ),
    tally as (
      select sb.book_id,
             coalesce((select count(*) from active a where a.choice = sb.book_id), 0) as votes
      from public.voting_session_books sb
      where sb.voting_session_id = p_session_id
        and not (sb.book_id = any(v_eliminated))
    )
    select jsonb_agg(jsonb_build_object('book_id', t.book_id, 'votes', t.votes) order by t.votes desc, t.book_id),
           (select count(*) from active a where a.choice is not null),
           (select t2.book_id from tally t2 order by t2.votes desc, t2.book_id limit 1),
           (select t3.votes from tally t3 order by t3.votes desc, t3.book_id limit 1),
           (select count(*) from tally t5),
           (select t4.book_id from tally t4 order by t4.votes asc, t4.book_id desc limit 1)
      into v_round_counts, v_active_ballots, v_leader, v_leader_votes, v_remaining, v_loser
    from tally t;

    v_rounds := v_rounds || jsonb_build_array(jsonb_build_object(
      'round', v_round,
      'active_ballots', v_active_ballots,
      'counts', coalesce(v_round_counts, '[]'::jsonb)
    ));

    if v_remaining <= 1 or (v_active_ballots > 0 and v_leader_votes * 2 > v_active_ballots) then
      v_winner := v_leader;
      exit;
    end if;

    if v_active_ballots = 0 then
      v_winner := v_leader;
      exit;
    end if;

    v_eliminated := v_eliminated || v_loser;
  end loop;

  v_results := jsonb_build_object(
    'total_ballots', v_total_ballots,
    'rounds', v_rounds,
    'winner_book_id', v_winner
  );

  update public.voting_sessions
    set status = 'completed', ended_at = now(), winning_book_id = v_winner, results = v_results
    where id = p_session_id;

  if exists (select 1 from public.reads r where r.club_id = v_club_id and r.status = 'current') then
    update public.reads set status = 'up_next', book_id = v_winner where id = v_read_id;
  else
    update public.reads set status = 'current', book_id = v_winner where id = v_read_id;
    update public.clubs set current_book_id = v_winner where id = v_club_id;
  end if;

  return v_results;
end;
$function$;

-- Supabase grants EXECUTE on new functions to anon; only signed-in members
-- should reach these.
revoke execute on function public.start_next_read(uuid, date, date) from anon, public;
revoke execute on function public.update_read_dates(uuid, date, date) from anon, public;
revoke execute on function public.finish_read(uuid) from anon, public;
revoke execute on function public.reopen_read(uuid) from anon, public;
revoke execute on function public.start_voting_session(uuid) from anon, public;
revoke execute on function public.close_voting_session(uuid) from anon, public;
grant execute on function public.start_next_read(uuid, date, date) to authenticated;
grant execute on function public.update_read_dates(uuid, date, date) to authenticated;
grant execute on function public.finish_read(uuid) to authenticated;
grant execute on function public.reopen_read(uuid) to authenticated;
grant execute on function public.start_voting_session(uuid) to authenticated;
grant execute on function public.close_voting_session(uuid) to authenticated;
