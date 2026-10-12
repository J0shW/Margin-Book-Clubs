-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- clubs
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique,
  current_book_id uuid,
  created_at timestamptz not null default now()
);

-- club members
create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_members_user_idx on public.club_members(user_id);

-- books catalog
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  google_books_id text not null unique,
  title text not null,
  authors text[] not null default '{}',
  description text,
  cover_image_url text,
  published_date text,
  page_count int,
  created_at timestamptz not null default now()
);

alter table public.clubs
  add constraint clubs_current_book_fkey
  foreign key (current_book_id) references public.books(id) on delete set null;

-- candidate books
create table if not exists public.club_candidate_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (club_id, book_id)
);
create index if not exists candidate_books_club_idx on public.club_candidate_books(club_id);

-- voting sessions
create table if not exists public.voting_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  winning_book_id uuid references public.books(id) on delete set null,
  results jsonb
);
create unique index if not exists one_active_session_per_club
  on public.voting_sessions(club_id) where status = 'active';
create index if not exists voting_sessions_club_idx on public.voting_sessions(club_id);

-- books locked into a session
create table if not exists public.voting_session_books (
  voting_session_id uuid not null references public.voting_sessions(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  primary key (voting_session_id, book_id)
);

-- votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  voting_session_id uuid not null references public.voting_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (voting_session_id, user_id)
);

create table if not exists public.vote_rankings (
  vote_id uuid not null references public.votes(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rank int not null check (rank >= 1),
  primary key (vote_id, book_id),
  unique (vote_id, rank)
);
