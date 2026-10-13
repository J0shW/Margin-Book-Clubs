# 0010. Book details come from the providers, not the browser

- **Status:** Accepted
- **Date:** 2026-10-13
- **Related:** `lib/book-sources.ts`, `app/clubs/actions.ts`, `supabase/migrations/20261015120000_book_catalog_checks.sql`, [0003](0003-database-access-through-rls-and-rpcs.md), [0004](0004-book-search-title-author-english.md)

## Context

`books` is one catalog shared by every club, keyed by `source_id`
(`gb:<Google volume id>`, `ol:/works/<Open Library id>`, or `manual:<uuid>`).
The first nomination of a book creates its row, and later nominations from
any club reuse it; RLS blocks updates so one club can't edit what others see.

Nominating used to send the whole search result from the browser, and the
server saved it as given. Anyone signed in could therefore create the row
for a real book with a wrong title, an offensive description, or a cover
image on any host (a tracking pixel, say), and every club nominating that
book afterwards would see it.

## Decision

- **The browser sends only the source id.** `nominateBookAction` reuses the
  catalog row if one exists; otherwise it fetches the book from Google Books
  (`volumes/<id>`) or Open Library (search by work key, falling back to the
  work record) and saves what the provider returns.
- **Covers are limited to provider hosts:** `books.google.com`,
  `books.googleusercontent.com` and `covers.openlibrary.org`.
- **The database enforces the shape of every row,** since the REST API
  still allows direct inserts: `source_id` format, cover host (and no cover
  on manual books), title 1–300 characters, description up to 4,000,
  at most 10 authors and 3 categories, a year/year-month/date
  `published_date`, and `page_count` between 1 and 20,000.
- **Manual books are validated the same way on the form and the server**
  (`lib/manual-book.ts`).

## Alternatives considered

- **Sign search results on the server and verify the signature when
  nominating** — no second provider call, but needs a new secret in every
  environment.
- **Write books only with the service-role key** — closes direct inserts
  entirely, but adds a powerful secret to the app server, which
  [0003](0003-database-access-through-rls-and-rpcs.md) avoids.

## Consequences

Nominating a new book costs one provider call, and fails with "Couldn't load
that book's details" if the provider is down or rate limited; setting
`GOOGLE_BOOKS_API_KEY` keeps Google's quota from being the cause. A
signed-in user calling the REST API directly could still create a
well-formed row with a wrong title for a book nobody has nominated yet;
that's accepted for a small invite-only app, and the checks keep it to
plain text with no foreign images.
