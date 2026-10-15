# 0006. Organize a club around reads with a fixed lifecycle

- **Status:** Accepted (nomination default changed to 1 by [0011](0011-organizer-club-controls.md))
- **Date:** 2026-10-12
- **Related:** PRs #19, #20, #21; `supabase/migrations/20261013120000_reads.sql`, `lib/reads.ts`

## Context

Originally a club had one shortlist and voting sessions with no notion of
which book the club was reading, when, or what it had read before. The
club page needed "current read, next read, past reads" with dates,
history and ratings.

## Decision

- Each book a club picks is a numbered **read** that moves through
  `nominating → voting → up_next → current → finished`.
- A club has **at most one current read and one next read**, so the next
  pick can happen while the current book is still being read.
- **Nominations belong to a read.** Each member can nominate several books
  per read, up to a per-club cap
  (`max_nominations_per_member`, default 3). A trigger routes new
  nominations to the next read, opening one if none exists, and blocks
  them once voting starts. Books that lost can be brought back for the
  next read.
- **Dates (start and discussion) are optional** and can be set when the
  read is created or later.
- A read **ends only when the organizer marks it finished**, never
  automatically by date. Finishing promotes an up-next book to current.
  The most recent finished read can be reopened if nothing is current.
- Every read has a detail page at `/clubs/[clubId]/reads/[number]` with
  its nominations, vote results and ratings.

## Alternatives considered

- **Close reads automatically on the discussion date** — clubs slip, and
  a book silently disappearing would be confusing.
- **One nomination per member** — too limiting for small clubs.

## Consequences

The club page has a clear structure and keeps history. Lifecycle changes
must go through the read functions (`start_next_read`, `finish_read`,
`reopen_read`, voting RPCs) to keep the one-current/one-next rule.
