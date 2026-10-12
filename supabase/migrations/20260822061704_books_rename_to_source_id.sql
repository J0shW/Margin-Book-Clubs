alter table public.books rename column google_books_id to source_id;
alter index if exists books_google_books_id_key rename to books_source_id_key;
