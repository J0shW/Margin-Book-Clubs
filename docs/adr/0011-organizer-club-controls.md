# 0011. Organizers rename, hand off and delete clubs, and set the nomination limit

- **Status:** Accepted (changes the nomination default in [0006](0006-reads-lifecycle.md))
- **Date:** 2026-10-15
- **Related:** `supabase/migrations/20261016120000_organizer_club_controls.sql`, `components/clubs/organizer-settings.tsx`, [0003](0003-database-access-through-rls-and-rpcs.md)

## Context

The organizer couldn't rename the club, change how many books each member
may nominate, pass the club to someone else, or delete it. The
`clubs_update_owner` policy also let the organizer change any column
directly through the REST API, including the join code and the current book.

## Decision

- **Rename and nomination limit** are direct updates from club settings.
  Names are trimmed and 1–80 characters (a check constraint); the limit
  is 1–10 per member per read.
- **New clubs allow 1 nomination per member per read** (was 3). Existing
  clubs keep their limit. Lowering it doesn't remove nominations already made.
- **Column-level grants:** `authenticated` may update only `name`,
  `voting_method` and `max_nominations_per_member` on `clubs`. The join code,
  current book and owner change only through functions.
- **Hand off** uses `transfer_club_ownership(club, member)`: the caller must
  be the organizer and the new organizer a current member. The previous
  organizer stays as a member, so they can now leave.
- **Delete** uses the existing owner-only delete policy, after typing the
  club's name to confirm. Members, reads, nominations, votes and ratings
  cascade; books stay in the shared catalog.

## Alternatives considered

- **Keep 3 as the default** — the owner preferred one pick each, so every
  nomination is someone's real choice.
- **Co-organizers instead of a hand-off** — more permissions to design;
  a single organizer is enough for now.
- **Soft delete** — recoverable, but adds a state every query must filter;
  the typed confirmation is the safeguard instead.

## Consequences

Organizers can run the club entirely from settings. Deleting is permanent.
A club always has exactly one organizer, and only they can hand it back.
