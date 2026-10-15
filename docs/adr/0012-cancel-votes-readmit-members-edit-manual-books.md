# 0012. Cancelling a vote discards it; letting a member back in lifts the block

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** `supabase/migrations/20261017120000_readmit_cancel_vote_edit_books.sql`, [0005](0005-short-join-codes-and-member-removal.md), [0008](0008-consensus-voting.md), [0010](0010-book-details-come-from-providers.md)

## Context

Organizers had no way out of a vote opened too early or stuck in a tie, no
way to undo removing a member, and no way to fix a typo in a book they
added by hand.

## Decision

- **Cancel vote** (`cancel_voting_session`, organizer only, open or tied
  votes): the vote and its ballots are deleted and the read goes back to
  taking nominations with the same shortlist. A new vote starts fresh.
- **Let back in** (`readmit_club_member`, organizer only): removes the
  person from `club_removed_members` so they can rejoin with the join code.
  It doesn't add them back by itself. The organizer can now read that
  table for their own club, so the settings dialog lists removed members.
- **Edit hand-added books** (`update_manual_book`): only `manual:` books,
  only by someone who nominated it or the organizer of a club it's
  nominated in, and allowed even during voting. Books from search stay
  read-only, per [0010](0010-book-details-come-from-providers.md).

## Alternatives considered

- **Keep ballots when cancelling and reuse them on reopen** — the shortlist
  can change in between, so old ballots wouldn't match it.
- **Re-add a readmitted member directly** — puts someone back in a club
  without them choosing to rejoin.

## Consequences

Cancelling is final for the ballots cast, so the confirmation says how many
will be discarded. A readmitted person has to rejoin themselves.
