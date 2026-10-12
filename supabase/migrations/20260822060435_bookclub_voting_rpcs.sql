-- Start a voting round: owner only, snapshots current candidate books
create or replace function public.start_voting_session(p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_count int;
begin
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
    raise exception 'not_club_owner';
  end if;

  if exists (select 1 from public.voting_sessions s where s.club_id = p_club_id and s.status = 'active') then
    raise exception 'session_already_active';
  end if;

  select count(*) into v_count from public.club_candidate_books b where b.club_id = p_club_id;
  if v_count < 2 then
    raise exception 'need_two_candidates';
  end if;

  insert into public.voting_sessions (club_id) values (p_club_id) returning id into v_session_id;

  insert into public.voting_session_books (voting_session_id, book_id)
  select v_session_id, b.book_id from public.club_candidate_books b where b.club_id = p_club_id;

  return v_session_id;
end;
$$;

-- Submit a ranked ballot atomically. p_book_ids ordered best-first.
create or replace function public.submit_ballot(p_session_id uuid, p_book_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vote_id uuid;
  v_club_id uuid;
  v_status text;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select s.club_id, s.status into v_club_id, v_status
  from public.voting_sessions s where s.id = p_session_id;

  if v_club_id is null then raise exception 'session_not_found'; end if;
  if v_status <> 'active' then raise exception 'session_not_active'; end if;

  if not exists (
    select 1 from public.club_members m
    where m.club_id = v_club_id and m.user_id = auth.uid()
  ) then
    raise exception 'not_club_member';
  end if;

  if p_book_ids is null or array_length(p_book_ids, 1) is null then
    raise exception 'empty_ballot';
  end if;

  -- every ranked book must belong to this session, no duplicates
  if exists (
    select 1 from unnest(p_book_ids) as b(id)
    where not exists (
      select 1 from public.voting_session_books sb
      where sb.voting_session_id = p_session_id and sb.book_id = b.id
    )
  ) then
    raise exception 'invalid_book_in_ballot';
  end if;

  if (select count(distinct id) from unnest(p_book_ids) as b(id)) <> array_length(p_book_ids, 1) then
    raise exception 'duplicate_book_in_ballot';
  end if;

  insert into public.votes (voting_session_id, user_id)
  values (p_session_id, auth.uid())
  returning id into v_vote_id;

  for i in 1..array_length(p_book_ids, 1) loop
    insert into public.vote_rankings (vote_id, book_id, rank)
    values (v_vote_id, p_book_ids[i], i);
  end loop;
end;
$$;

-- Close the round and tally with instant-runoff voting.
create or replace function public.close_voting_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
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
  select s.club_id, s.status into v_club_id, v_status
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

    -- current top choice per ballot among non-eliminated books
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
           (select count(*) from tally),
           (select t4.book_id from tally t4 order by t4.votes asc, t4.book_id desc limit 1)
      into v_round_counts, v_active_ballots, v_leader, v_leader_votes, v_remaining, v_loser
    from tally;

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

  update public.clubs set current_book_id = v_winner where id = v_club_id;

  return v_results;
end;
$$;

revoke all on function public.start_voting_session(uuid) from public;
revoke all on function public.submit_ballot(uuid, uuid[]) from public;
revoke all on function public.close_voting_session(uuid) from public;
grant execute on function public.start_voting_session(uuid) to authenticated;
grant execute on function public.submit_ballot(uuid, uuid[]) to authenticated;
grant execute on function public.close_voting_session(uuid) to authenticated;
