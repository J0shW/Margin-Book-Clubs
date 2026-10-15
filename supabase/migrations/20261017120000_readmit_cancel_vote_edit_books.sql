-- More organizer controls: let a removed member back in, cancel a vote, and
-- fix the details of a book that was added by hand.

-- 1. Removed members. The organizer can see who was removed from their club
--    (with names, via a profiles FK for PostgREST embeds) and lift the block.
alter table public.club_removed_members
  add constraint club_removed_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

grant select on public.club_removed_members to authenticated;
create policy club_removed_members_select_owner on public.club_removed_members
  for select to authenticated using (public.is_club_owner(club_id));

-- Lifts the block so they can rejoin with the join code; it doesn't add them
-- back by itself.
create or replace function public.readmit_club_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
    raise exception 'not_club_owner';
  end if;

  delete from public.club_removed_members r where r.club_id = p_club_id and r.user_id = p_user_id;
  if not found then
    raise exception 'not_removed';
  end if;
end;
$$;

revoke execute on function public.readmit_club_member(uuid, uuid) from anon, public;
grant execute on function public.readmit_club_member(uuid, uuid) to authenticated;

-- 2. Cancel an open or tied vote. Its ballots are discarded and the read goes
--    back to taking nominations, with its shortlist intact.
create or replace function public.cancel_voting_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_read_id uuid;
  v_status text;
begin
  select s.club_id, s.read_id, s.status into v_club_id, v_read_id, v_status
  from public.voting_sessions s where s.id = p_session_id
  for update;

  if v_club_id is null then raise exception 'session_not_found'; end if;
  if not public.is_club_owner(v_club_id) then raise exception 'not_club_owner'; end if;
  if v_status not in ('active', 'tied') then raise exception 'session_not_active'; end if;

  -- Ballots, rankings and the ballot's book list cascade.
  delete from public.voting_sessions where id = p_session_id;
  update public.reads set status = 'nominating' where id = v_read_id and status = 'voting';
end;
$$;

revoke execute on function public.cancel_voting_session(uuid) from anon, public;
grant execute on function public.cancel_voting_session(uuid) to authenticated;

-- 3. Edit a hand-added book. Only manual books (search results come from the
--    providers) and only by someone who nominated it or organizes a club it
--    was nominated in. The books table's checks validate the values.
create or replace function public.update_manual_book(
  p_book_id uuid,
  p_title text,
  p_authors text[],
  p_published_date text,
  p_page_count int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.books b where b.id = p_book_id and b.source_id like 'manual:%') then
    raise exception 'book_not_editable';
  end if;
  if not exists (
    select 1 from public.club_candidate_books cb
    where cb.book_id = p_book_id
      and public.is_club_member(cb.club_id)
      and (cb.added_by = auth.uid() or public.is_club_owner(cb.club_id))
  ) then
    raise exception 'book_not_editable';
  end if;

  update public.books
  set title = trim(p_title),
      authors = coalesce(p_authors, '{}'),
      published_date = nullif(trim(p_published_date), ''),
      page_count = p_page_count
  where id = p_book_id;
end;
$$;

revoke execute on function public.update_manual_book(uuid, text, text[], text, int) from anon, public;
grant execute on function public.update_manual_book(uuid, text, text[], text, int) to authenticated;
