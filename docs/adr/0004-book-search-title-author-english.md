# 0004. Book search matches title and author, in English, with prefix matching

- **Status:** Accepted
- **Date:** 2026-10-12
- **Related:** PRs #2, #3, #16, #17; `lib/book-search.ts`, `app/api/books/`

## Context

Members nominate books by searching. Results were poor: typing
"Operation bou" searched for the literal word "bou", and both providers
match full text and subjects, so government reports and reference books
outranked the novel being typed.

## Decision

- **Sources:** Google Books (optional `GOOGLE_BOOKS_API_KEY`) and Open
  Library, queried from our own `/api/books` route, with manual entry as
  a fallback when a book can't be found.
- **Every typed word must appear in the title or authors.** The last
  word is treated as a prefix unless followed by a space, so the dialog
  sends the query untrimmed. A second query of just the finished words
  is merged in, and prefix matches rank first.
- **English only:** Google's `langRestrict=en` plus a per-volume
  language check; Open Library works without an English edition are
  dropped.
- Editions with the same title and first author collapse into one row;
  results missing an author or cover sort last. ISBNs skip filtering
  and go straight to `isbn:` lookups.

## Alternatives considered

- **Accept the providers' ranking** — it's tuned for full-text search,
  which is the wrong job here.
- **Build our own catalog index** — far more work than a club app needs.

## Consequences

Searches find the book being typed far more often. Non-English books
can't be found by search and need manual entry. Searching by subject or
description isn't supported.
