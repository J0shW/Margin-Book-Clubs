-- PostgREST needs a real FK to embed profiles(...) from these tables.
alter table public.club_members
  add constraint club_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.club_candidate_books
  add constraint club_candidate_books_added_by_profiles_fkey
  foreign key (added_by) references public.profiles(id) on delete cascade;

alter table public.votes
  add constraint votes_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
