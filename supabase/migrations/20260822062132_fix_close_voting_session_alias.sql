create or replace function public.close_voting_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  update public.clubs set current_book_id = v_winner where id = v_club_id;

  return v_results;
end;
$function$;
