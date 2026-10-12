-- membership helper (security definer to avoid recursive RLS)
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_club_owner(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = p_club_id and c.owner_id = auth.uid()
  );
$$;

-- enable RLS
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.books enable row level security;
alter table public.club_candidate_books enable row level security;
alter table public.voting_sessions enable row level security;
alter table public.voting_session_books enable row level security;
alter table public.votes enable row level security;
alter table public.vote_rankings enable row level security;

-- profiles: readable by anyone authenticated (needed to show member names), writable by self
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id);

-- clubs: members can read; owner can update/delete. Insert only via RPC.
drop policy if exists clubs_select_member on public.clubs;
create policy clubs_select_member on public.clubs for select to authenticated
  using (public.is_club_member(id) or owner_id = auth.uid());
drop policy if exists clubs_update_owner on public.clubs;
create policy clubs_update_owner on public.clubs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists clubs_delete_owner on public.clubs;
create policy clubs_delete_owner on public.clubs for delete to authenticated
  using (owner_id = auth.uid());

-- club_members: members of a club can see the roster; leaving own membership allowed.
drop policy if exists club_members_select on public.club_members;
create policy club_members_select on public.club_members for select to authenticated
  using (user_id = auth.uid() or public.is_club_member(club_id));
drop policy if exists club_members_delete on public.club_members;
create policy club_members_delete on public.club_members for delete to authenticated
  using (user_id = auth.uid() or public.is_club_owner(club_id));

-- books: shared catalog, readable + insertable by authenticated users
drop policy if exists books_select on public.books;
create policy books_select on public.books for select to authenticated using (true);
drop policy if exists books_insert on public.books;
create policy books_insert on public.books for insert to authenticated with check (true);

-- candidate books: members read; members add (must own the row and be a member); remover = adder or club owner
drop policy if exists candidates_select on public.club_candidate_books;
create policy candidates_select on public.club_candidate_books for select to authenticated
  using (public.is_club_member(club_id));
drop policy if exists candidates_insert on public.club_candidate_books;
create policy candidates_insert on public.club_candidate_books for insert to authenticated
  with check (added_by = auth.uid() and public.is_club_member(club_id));
drop policy if exists candidates_delete on public.club_candidate_books;
create policy candidates_delete on public.club_candidate_books for delete to authenticated
  using (public.is_club_member(club_id) and (added_by = auth.uid() or public.is_club_owner(club_id)));

-- voting sessions: members read, owner starts. Closing happens through RPC.
drop policy if exists sessions_select on public.voting_sessions;
create policy sessions_select on public.voting_sessions for select to authenticated
  using (public.is_club_member(club_id));
drop policy if exists sessions_insert_owner on public.voting_sessions;
create policy sessions_insert_owner on public.voting_sessions for insert to authenticated
  with check (public.is_club_owner(club_id));

drop policy if exists session_books_select on public.voting_session_books;
create policy session_books_select on public.voting_session_books for select to authenticated
  using (exists (
    select 1 from public.voting_sessions s
    where s.id = voting_session_id and public.is_club_member(s.club_id)
  ));
drop policy if exists session_books_insert on public.voting_session_books;
create policy session_books_insert on public.voting_session_books for insert to authenticated
  with check (exists (
    select 1 from public.voting_sessions s
    where s.id = voting_session_id and public.is_club_owner(s.club_id)
  ));

-- votes: a member may see who has voted, but only own rankings.
drop policy if exists votes_select on public.votes;
create policy votes_select on public.votes for select to authenticated
  using (exists (
    select 1 from public.voting_sessions s
    where s.id = voting_session_id and public.is_club_member(s.club_id)
  ));
drop policy if exists votes_insert_own on public.votes;
create policy votes_insert_own on public.votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.voting_sessions s
      where s.id = voting_session_id
        and s.status = 'active'
        and public.is_club_member(s.club_id)
    )
  );

drop policy if exists rankings_select_own on public.vote_rankings;
create policy rankings_select_own on public.vote_rankings for select to authenticated
  using (exists (select 1 from public.votes v where v.id = vote_id and v.user_id = auth.uid()));
drop policy if exists rankings_insert_own on public.vote_rankings;
create policy rankings_insert_own on public.vote_rankings for insert to authenticated
  with check (exists (select 1 from public.votes v where v.id = vote_id and v.user_id = auth.uid()));

-- auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- create club + owner membership atomically
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
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.clubs c where c.join_code = v_code);
  end loop;

  insert into public.clubs (name, owner_id, join_code)
  values (left(trim(p_name), 80), auth.uid(), v_code)
  returning * into v_club;

  insert into public.club_members (club_id, user_id) values (v_club.id, auth.uid());

  return v_club;
end;
$$;

-- join a club by code
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

  select c.id into v_club_id from public.clubs c
  where c.join_code = upper(trim(p_code));

  if v_club_id is null then
    raise exception 'invalid_join_code';
  end if;

  insert into public.club_members (club_id, user_id)
  values (v_club_id, auth.uid())
  on conflict do nothing;

  return v_club_id;
end;
$$;

revoke all on function public.create_club(text) from public;
revoke all on function public.join_club(text) from public;
grant execute on function public.create_club(text) to authenticated;
grant execute on function public.join_club(text) to authenticated;
