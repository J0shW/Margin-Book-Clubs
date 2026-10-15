-- Organizer controls: rename the club, set the nomination limit, hand the
-- club to another member, and delete it.

-- 1. New clubs allow one nomination per member per read. Existing clubs keep
--    their limit; the organizer can change it in club settings.
alter table public.clubs alter column max_nominations_per_member set default 1;

-- 2. Club names are trimmed, non-empty and at most 80 characters, as
--    create_club already makes them.
alter table public.clubs
  add constraint clubs_name_length check (name = trim(name) and char_length(name) between 1 and 80);

-- 3. The organizer may edit only these columns directly. The join code, the
--    current book and the owner change only through functions that check the
--    rules (start/finish reads, votes, transfer_club_ownership below).
revoke update on public.clubs from authenticated;
grant update (name, voting_method, max_nominations_per_member) on public.clubs to authenticated;

-- 4. Hand the club to another member. The previous organizer stays a member.
create or replace function public.transfer_club_ownership(p_club_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
    raise exception 'not_club_owner';
  end if;
  if p_new_owner_id = auth.uid() then
    raise exception 'already_owner';
  end if;
  if not exists (
    select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = p_new_owner_id
  ) then
    raise exception 'not_club_member';
  end if;

  update public.clubs set owner_id = p_new_owner_id where id = p_club_id;
end;
$$;

revoke execute on function public.transfer_club_ownership(uuid, uuid) from anon, public;
grant execute on function public.transfer_club_ownership(uuid, uuid) to authenticated;

-- Deleting a club uses the existing clubs_delete_owner policy; everything
-- that belongs to the club (members, reads, nominations, votes, ratings)
-- cascades. Books stay in the shared catalog.
