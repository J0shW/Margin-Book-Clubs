alter table public.books
  add column if not exists categories text[] not null default '{}';
