-- Voting methods. Ballots are the same ranked list either way; only the count
-- differs:
--
--   consensus (default): each ballot gives a book
--       points = n * (1 - ((rank - 1) / (n - 1))^2)      (n = books on the ballot)
--     so 1st is worth n, last is worth 0, and the steps between positions grow
--     toward the bottom. Highest total wins. Ties: fewest last-place rankings,
--     then most first-place rankings, then the organizer picks.
--
--   runoff: instant runoff, as before, but ties for last place are broken by
--     most last-place rankings, then fewest first-place rankings; if books are
--     still tied they're all eliminated, unless that would eliminate every
--     remaining book, in which case the organizer picks.
--
-- A vote's method is fixed when it opens, so changing the club setting only
-- affects the next vote. When a count ends in a tie it waits in status 'tied'
-- until the organizer picks the winner.

alter table public.clubs
  add column voting_method text not null default 'consensus'
  check (voting_method in ('consensus', 'runoff'));

-- Every existing vote was opened under runoff rules, including any still open.
alter table public.voting_sessions
  add column method text not null default 'runoff'
  check (method in ('consensus', 'runoff'));
alter table public.voting_sessions alter column method set default 'consensus';

alter table public.voting_sessions drop constraint voting_sessions_status_check;
alter table public.voting_sessions
  add constraint voting_sessions_status_check check (status in ('active', 'tied', 'completed'));

-- A tied vote is still unresolved, so it blocks opening another one too.
drop index if exists public.one_active_session_per_club;
create unique index one_active_session_per_club
  on public.voting_sessions(club_id) where status in ('active', 'tied');

-- Records the result and moves the read along: the winner becomes the current
-- read, or waits as up_next while another read is current. Internal only.
create or replace function public.complete_voting_session(p_session_id uuid, p_winner uuid, p_results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_read_id uuid;
begin
  select s.club_id, s.read_id into v_club_id, v_read_id
  from public.voting_sessions s where s.id = p_session_id;

  update public.voting_sessions
    set status = 'completed', ended_at = now(), winning_book_id = p_winner, results = p_results
    where id = p_session_id;

  if exists (select 1 from public.reads r where r.club_id = v_club_id and r.status = 'current') then
    update public.reads set status = 'up_next', book_id = p_winner where id = v_read_id;
  else
    update public.reads set status = 'current', book_id = p_winner where id = v_read_id;
    update public.clubs set current_book_id = p_winner where id = v_club_id;
  end if;
end;
$$;

-- Points, first-place and last-place counts per book for one vote. A book a
-- ballot leaves unranked counts as last on that ballot (the app always ranks
-- every book, but the database accepts partial ballots).
create or replace function public.consensus_standings(p_session_id uuid)
returns table (book_id uuid, points numeric, firsts int, lasts int)
language sql
stable
security definer
set search_path = ''
as $$
  with books as (
    select sb.book_id from public.voting_session_books sb where sb.voting_session_id = p_session_id
  ),
  n as (select count(*)::numeric as n from books),
  ballots as (
    select v.id from public.votes v where v.voting_session_id = p_session_id
  ),
  cells as (
    select b.book_id, r.rank
    from books b
    cross join ballots bl
    left join public.vote_rankings r on r.vote_id = bl.id and r.book_id = b.book_id
  )
  select
    c.book_id,
    round(sum(
      case
        when c.rank is null then 0
        when n.n <= 1 then 1
        else n.n * (1 - power((c.rank - 1)::numeric / (n.n - 1), 2))
      end
    ), 4) as points,
    (count(*) filter (where c.rank = 1))::int as firsts,
    (count(*) filter (where c.rank is null or c.rank >= n.n))::int as lasts
  from cells c cross join n
  group by c.book_id, n.n
$$;

create or replace function public.tally_consensus(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_ballots int;
  v_book_count int;
  v_standings jsonb;
  v_tied uuid[];
  v_decided_by text := 'points';
  v_best numeric;
begin
  select count(*) into v_total_ballots from public.votes v where v.voting_session_id = p_session_id;
  select count(*) into v_book_count from public.voting_session_books sb where sb.voting_session_id = p_session_id;

  select jsonb_agg(
           jsonb_build_object('book_id', s.book_id, 'points', s.points, 'firsts', s.firsts, 'lasts', s.lasts)
           order by s.points desc, s.lasts asc, s.firsts desc, s.book_id
         )
    into v_standings
  from public.consensus_standings(p_session_id) s;

  -- Highest points.
  select max(s.points) into v_best from public.consensus_standings(p_session_id) s;
  select array_agg(s.book_id) into v_tied
  from public.consensus_standings(p_session_id) s where s.points = v_best;

  -- Then fewest last-place rankings.
  if array_length(v_tied, 1) > 1 then
    v_decided_by := 'fewest_last';
    select min(s.lasts) into v_best
    from public.consensus_standings(p_session_id) s where s.book_id = any(v_tied);
    select array_agg(s.book_id) into v_tied
    from public.consensus_standings(p_session_id) s where s.book_id = any(v_tied) and s.lasts = v_best;
  end if;

  -- Then most first-place rankings.
  if array_length(v_tied, 1) > 1 then
    v_decided_by := 'most_first';
    select max(s.firsts) into v_best
    from public.consensus_standings(p_session_id) s where s.book_id = any(v_tied);
    select array_agg(s.book_id) into v_tied
    from public.consensus_standings(p_session_id) s where s.book_id = any(v_tied) and s.firsts = v_best;
  end if;

  return jsonb_build_object(
    'method', 'consensus',
    'total_ballots', v_total_ballots,
    'book_count', v_book_count,
    'standings', coalesce(v_standings, '[]'::jsonb),
    'winner_book_id', case when array_length(v_tied, 1) = 1 then v_tied[1] end,
    'decided_by', case when array_length(v_tied, 1) = 1 then v_decided_by end,
    'tied_book_ids', case when array_length(v_tied, 1) > 1 then to_jsonb(v_tied) end
  );
end;
$$;

create or replace function public.tally_runoff(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eliminated uuid[] := '{}';
  v_total_ballots int;
  v_round int := 0;
  v_rounds jsonb := '[]'::jsonb;
  v_tally jsonb;
  v_active_ballots int;
  v_remaining int;
  v_leader uuid;
  v_leader_votes int;
  v_min_votes int;
  v_last uuid[];
  v_out uuid[];
  v_tiebreak text;
  v_best int;
  v_winner uuid;
  v_decided_by text;
  v_tied uuid[];
begin
  select count(*) into v_total_ballots from public.votes v where v.voting_session_id = p_session_id;

  loop
    v_round := v_round + 1;
    v_out := null;
    v_tiebreak := null;

    -- Votes per remaining book: each ballot counts for its highest-ranked book
    -- still in the running.
    with active as (
      select (select r.book_id from public.vote_rankings r
               where r.vote_id = v.id and not (r.book_id = any(v_eliminated))
               order by r.rank asc limit 1) as choice
      from public.votes v
      where v.voting_session_id = p_session_id
    )
    select
      jsonb_agg(jsonb_build_object(
        'book_id', sb.book_id,
        'votes', (select count(*) from active a where a.choice = sb.book_id)
      ) order by (select count(*) from active a where a.choice = sb.book_id) desc, sb.book_id),
      (select count(*) from active a where a.choice is not null)
    into v_tally, v_active_ballots
    from public.voting_session_books sb
    where sb.voting_session_id = p_session_id
      and not (sb.book_id = any(v_eliminated));

    select count(*), max(t.votes), min(t.votes)
      into v_remaining, v_leader_votes, v_min_votes
    from jsonb_to_recordset(v_tally) as t(book_id uuid, votes int);

    select t.book_id into v_leader
    from jsonb_to_recordset(v_tally) as t(book_id uuid, votes int)
    where t.votes = v_leader_votes order by t.book_id limit 1;

    -- A majority of ballots still in play, or only one book left, wins.
    if v_remaining <= 1
      or (v_active_ballots > 0 and v_leader_votes * 2 > v_active_ballots)
    then
      v_winner := v_leader;
      v_decided_by := case when v_remaining <= 1 then 'last_remaining' else 'majority' end;
    else
      -- Eliminate last place. Ties: most last-place rankings, then fewest
      -- first-place rankings (both over whole ballots), else all of them.
      select array_agg(t.book_id) into v_last
      from jsonb_to_recordset(v_tally) as t(book_id uuid, votes int)
      where t.votes = v_min_votes;

      if array_length(v_last, 1) > 1 then
        v_tiebreak := 'most_last';
        select max(s.lasts) into v_best
        from public.consensus_standings(p_session_id) s where s.book_id = any(v_last);
        select array_agg(s.book_id) into v_last
        from public.consensus_standings(p_session_id) s where s.book_id = any(v_last) and s.lasts = v_best;
      end if;

      if array_length(v_last, 1) > 1 then
        v_tiebreak := 'fewest_first';
        select min(s.firsts) into v_best
        from public.consensus_standings(p_session_id) s where s.book_id = any(v_last);
        select array_agg(s.book_id) into v_last
        from public.consensus_standings(p_session_id) s where s.book_id = any(v_last) and s.firsts = v_best;
      end if;

      if array_length(v_last, 1) > 1 then
        v_tiebreak := 'all_tied';
      end if;

      if array_length(v_last, 1) >= v_remaining then
        -- Every remaining book is tied all the way down: the organizer picks.
        select array_agg(t.book_id order by t.book_id) into v_tied
        from jsonb_to_recordset(v_tally) as t(book_id uuid, votes int);
      else
        v_out := v_last;
      end if;
    end if;

    v_rounds := v_rounds || jsonb_build_array(jsonb_build_object(
      'round', v_round,
      'active_ballots', v_active_ballots,
      'counts', coalesce(v_tally, '[]'::jsonb),
      'eliminated', coalesce(to_jsonb(v_out), '[]'::jsonb),
      'tiebreak', v_tiebreak
    ));

    exit when v_winner is not null or v_tied is not null;
    v_eliminated := v_eliminated || v_out;
  end loop;

  return jsonb_build_object(
    'method', 'runoff',
    'total_ballots', v_total_ballots,
    'rounds', v_rounds,
    'winner_book_id', v_winner,
    'decided_by', v_decided_by,
    'tied_book_ids', to_jsonb(v_tied)
  );
end;
$$;

create or replace function public.close_voting_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_method text;
  v_results jsonb;
begin
  select s.club_id, s.status, s.method into v_club_id, v_status, v_method
  from public.voting_sessions s where s.id = p_session_id;

  if v_club_id is null then raise exception 'session_not_found'; end if;
  if not public.is_club_owner(v_club_id) then raise exception 'not_club_owner'; end if;
  if v_status <> 'active' then raise exception 'session_not_active'; end if;
  if not exists (select 1 from public.votes v where v.voting_session_id = p_session_id) then
    raise exception 'no_ballots';
  end if;

  v_results := case v_method
    when 'runoff' then public.tally_runoff(p_session_id)
    else public.tally_consensus(p_session_id)
  end;

  if v_results->>'winner_book_id' is null then
    update public.voting_sessions set status = 'tied', results = v_results where id = p_session_id;
  else
    perform public.complete_voting_session(p_session_id, (v_results->>'winner_book_id')::uuid, v_results);
  end if;

  return v_results;
end;
$$;

-- Organizer: pick the winner of a tied vote from the tied books.
create or replace function public.resolve_vote_tie(p_session_id uuid, p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_status text;
  v_results jsonb;
begin
  select s.club_id, s.status, s.results into v_club_id, v_status, v_results
  from public.voting_sessions s where s.id = p_session_id;

  if v_club_id is null then raise exception 'session_not_found'; end if;
  if not public.is_club_owner(v_club_id) then raise exception 'not_club_owner'; end if;
  if v_status <> 'tied' then raise exception 'session_not_tied'; end if;
  if not (v_results->'tied_book_ids') ? p_book_id::text then raise exception 'book_not_tied'; end if;

  v_results := v_results || jsonb_build_object('winner_book_id', p_book_id, 'decided_by', 'organizer');
  perform public.complete_voting_session(p_session_id, p_book_id, v_results);
  return v_results;
end;
$$;

-- New votes use the club's current method.
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

  if exists (
    select 1 from public.voting_sessions s where s.club_id = p_club_id and s.status in ('active', 'tied')
  ) then
    raise exception 'session_already_active';
  end if;

  select r.id into v_read_id from public.reads r
  where r.club_id = p_club_id and r.status = 'nominating';

  select count(*) into v_count from public.club_candidate_books b where b.read_id = v_read_id;
  if v_read_id is null or v_count < 2 then
    raise exception 'need_two_candidates';
  end if;

  insert into public.voting_sessions (club_id, read_id, method)
  values (p_club_id, v_read_id, (select c.voting_method from public.clubs c where c.id = p_club_id))
  returning id into v_session_id;

  insert into public.voting_session_books (voting_session_id, book_id)
  select v_session_id, b.book_id from public.club_candidate_books b where b.read_id = v_read_id;

  update public.reads set status = 'voting' where id = v_read_id;

  return v_session_id;
end;
$$;

-- Internal helpers: callable only from the functions above.
revoke execute on function public.complete_voting_session(uuid, uuid, jsonb) from anon, authenticated, public;
revoke execute on function public.consensus_standings(uuid) from anon, authenticated, public;
revoke execute on function public.tally_consensus(uuid) from anon, authenticated, public;
revoke execute on function public.tally_runoff(uuid) from anon, authenticated, public;

revoke execute on function public.close_voting_session(uuid) from anon, public;
revoke execute on function public.resolve_vote_tie(uuid, uuid) from anon, public;
revoke execute on function public.start_voting_session(uuid) from anon, public;
grant execute on function public.close_voting_session(uuid) to authenticated;
grant execute on function public.resolve_vote_tie(uuid, uuid) to authenticated;
grant execute on function public.start_voting_session(uuid) to authenticated;
