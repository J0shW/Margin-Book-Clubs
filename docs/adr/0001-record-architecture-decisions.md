# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Margin has picked up a lot of deliberate choices: how votes are counted,
how long join codes are, how the database is locked down. The reasoning
lived in PR descriptions and chat, which is hard to find later and easy
to undo by accident.

## Decision

Record significant decisions as numbered Markdown files in `docs/adr/`,
using `template.md`. Each one says what was decided, why, and what else
was considered. ADRs are not edited to change a decision: a new ADR
supersedes the old one, and the old one's status points to it.

The `adr` skill in `.claude/skills/adr/` tells Claude when a change is
important enough to record and how to write it, so new ADRs land in the
same PR as the change.

## Alternatives considered

- **PR descriptions only** — already happening, but scattered and not
  browsable by topic.
- **A single DECISIONS.md** — simpler, but grows into one long file and
  makes superseding awkward.

## Consequences

Decisions are reviewable alongside the code that implements them. There
is a small cost per significant PR to write one, which the skill keeps low.
