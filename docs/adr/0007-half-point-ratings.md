# 0007. Rate finished reads from 0.5 to 10 in half points

- **Status:** Accepted
- **Date:** 2026-10-12
- **Related:** PR #22; `read_ratings`, `components/reads/rating-dialog.tsx`

## Context

Clubs wanted to record how much they liked each book and compare
opinions afterward.

## Decision

- Members rate a finished read **from 0.5 to 10 in half-point steps**,
  stored as an integer number of halves (`score_halves`, 1–20) to avoid
  float issues.
- Save stays disabled until a score is picked, so the slider's starting
  position never becomes a default rating. Ratings can be changed.
- The club page shows a **non-blocking prompt** to rate the most recently
  finished read until the member rates it or dismisses it (remembered per
  device).
- Lists show only the **club average**. A read's detail page shows the
  average and **each member's named score**.

## Alternatives considered

- **Five stars** — too coarse to separate books a club mostly liked.
- **Anonymous scores** — the club preferred seeing who thought what.

## Consequences

Ratings are visible to the whole club. Dismissing the prompt on one
device doesn't dismiss it on another.
