# 0008. Count ranked ballots by consensus points by default

- **Status:** Accepted
- **Date:** 2026-10-12
- **Related:** PR #24; `supabase/migrations/20261014120000_consensus_voting.sql`, `lib/voting.ts`

## Context

Members rank the nominated books top to bottom. The original count was
instant-runoff (IRV), which only looks at each ballot's top remaining
choice: a book everyone ranks second can lose to a polarizing book with
more firsts. IRV's ties were also broken arbitrarily by internal IDs.
The club wanted the winner to be the book the group is happiest with
overall, without asking members to score each book.

## Decision

- **Ballots stay a top-to-bottom ranking.** Members never enter numbers.
- **Consensus (default):** a book at rank *r* on a ballot of *n* books
  earns **n × (1 − ((r − 1) / (n − 1))²)** points. First is worth *n*,
  last is worth 0, and the curve keeps the top and middle close while
  the drop steepens toward the bottom, so being someone's last choice
  costs the most. Unranked books count as last. Highest total wins.
- **Consensus tiebreaks:** fewest last-place rankings, then most
  first-place rankings, then the organizer picks.
- **Runoff stays available** as a club setting. Its ties for last place
  are broken by most last-place rankings, then fewest first-place
  rankings, then eliminating the tied books together. If every remaining
  book is tied, the organizer picks.
- **The organizer chooses the method** in club settings
  (`clubs.voting_method`, default `consensus`). Each vote records its
  method when it opens, so a change only affects the next vote. Votes
  from before this change are marked `runoff`.
- An unresolved tie leaves the vote in a **`tied` status** until the
  organizer picks the winner with `resolve_vote_tie`.
- **Ballots start in a random order per member**, seeded by user and
  vote so it's stable across reloads, to avoid nomination-order bias.

## Alternatives considered

- **Borda count (linear points)** — penalizes a middle ranking as much as
  a bottom one.
- **Exponential decay curves**, e.g. n(1 − r/(n+1))^(r−1) — drop too
  fast near the top and behave very differently for 5 versus 10 books.
- **k = 1 (linear) or higher k** — k = 2 was chosen for keeping the top
  and middle close while making only the bottom steep.
- **Members score each book** — more effort than ranking, and scores
  aren't comparable between people.

## Consequences

Broadly liked books win over polarizing ones. Results show points with
first and last counts, or runoff rounds with eliminations, plus how the
winner was decided. Rare full ties need the organizer to act before the
read moves on.
