-- The books catalog is shared by every club, and signed-in users can insert
-- into it directly through the REST API. The app now looks book details up
-- on the server (lib/book-sources.ts) instead of trusting the browser; these
-- checks hold direct inserts to the same shape, so a row can't point its
-- cover at an arbitrary host or carry an unbounded title or description.

alter table public.books
  add constraint books_source_id_format check (
    source_id ~ '^(gb:[A-Za-z0-9_-]{1,40}|ol:/works/OL[0-9]{1,12}W|manual:[0-9a-f-]{36})$'
  ),
  add constraint books_cover_host check (
    cover_image_url is null
    or (
      source_id not like 'manual:%'
      and cover_image_url ~ '^https://(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)/'
    )
  ),
  add constraint books_title_length check (char_length(title) between 1 and 300),
  add constraint books_description_length check (description is null or char_length(description) <= 4000),
  add constraint books_authors_count check (cardinality(authors) <= 10),
  add constraint books_categories_count check (cardinality(categories) <= 3),
  add constraint books_published_date_format check (
    published_date is null or published_date ~ '^[0-9]{1,4}(-[0-9]{2}(-[0-9]{2})?)?$'
  ),
  add constraint books_page_count_range check (page_count is null or page_count between 1 and 20000);
