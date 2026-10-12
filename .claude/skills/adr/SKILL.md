---
name: adr
description: Write an architecture decision record (ADR) in docs/adr/ for Margin. Use proactively, without being asked, whenever a change in this repo makes a significant decision — a new or changed database rule, RPC, or permission model; a voting, rating, or read-lifecycle rule; a security trade-off; a new external service, dependency, or hosting/cron setup; or a product rule the user chose between options for. Also use when the user asks to record, document, or supersede a decision. Skip it for bug fixes, styling, copy, refactors, and anything that just follows an existing ADR.
---

# Architecture decision records

Margin keeps short records of significant decisions in `docs/adr/`, so
the reasoning survives after the chat and the PR are gone. This skill
covers deciding whether a change needs one and writing it.

## Does this change need an ADR?

Write one when **any** of these is true:

- It **changes how data is protected or accessed**: RLS policies,
  `SECURITY DEFINER` functions, grants, auth, rate limits, secrets.
- It **sets a product rule users will notice and someone could later
  "fix" by accident**: how votes are counted, tiebreaks, what ends a
  read, rating scale, join code format, who can do what.
- The user **chose between real options** (they were asked, or pushed
  back on a proposal), or accepted a known trade-off ("quick to type
  over super secure").
- It **adds or replaces a platform piece**: a service, provider,
  dependency with lock-in, cron job, or deployment setting.
- It **reverses or narrows an earlier ADR**.

Don't write one for bug fixes, UI layout and styling, copy changes,
refactors, test-only changes, or changes that just apply an existing
ADR. If unsure, ask: "would a future contributor reasonably undo this
without knowing why it was done?" If yes, write it.

## When to write it

Write the ADR **in the same branch and PR as the change**, once the
decision is settled. Write it after the user has decided, not while
options are still being discussed. Mention in the PR description that an
ADR was added. If several decisions come out of one PR, write one ADR
per decision unless they only make sense together.

## How to write it

1. Read `docs/adr/README.md` to see existing records. Check whether this
   decision updates one of them. If so, you're **superseding** it (step 5).
2. Take the next number: the highest `NNNN` in `docs/adr/` plus one,
   zero-padded to four digits.
3. Copy `docs/adr/template.md` to `docs/adr/NNNN-short-kebab-title.md`
   and fill it in:
   - **Title:** the decision itself ("Count ranked ballots by consensus
     points by default"), not the topic ("Voting").
   - **Status:** `Accepted`. **Date:** today. **Related:** PR number if
     known, migration files, key source files, related ADRs.
   - **Context:** the problem and the constraints, including what the
     user said they wanted, in plain words.
   - **Decision:** the concrete rule, with the real numbers, formulas,
     defaults and names (tables, functions, settings) so code can be
     checked against it.
   - **Alternatives considered:** the options actually discussed and why
     each lost. Don't invent strawmen.
   - **Consequences:** what gets easier, what gets harder, known gaps.
4. Add a row to the table in `docs/adr/README.md`.
5. **Superseding:** never rewrite an accepted ADR's decision. Write the
   new ADR. Set its status to `Accepted (supersedes NNNN)`, and change
   the old one's status to `Superseded by [MMMM](MMMM-....md)`. Update
   both rows in the README. Fixing typos or stale file paths in an old
   ADR is fine.

## Style

- Keep it to about a page. Use short paragraphs and bullets.
- Write for someone who knows the codebase but wasn't in the
  conversation. Explain jargon the first time it appears.
- State facts that are true in the code. Verify names against the repo
  before writing them.
- Don't include secrets, emails, or internal URLs that aren't already
  public.
