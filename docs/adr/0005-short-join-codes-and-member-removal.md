# 0005. Six-character join codes, with rate limiting and organizer removal

- **Status:** Accepted (supersedes the 10-character codes from PR #18)
- **Date:** 2026-10-12
- **Related:** PRs #18, #19

## Context

People join a club by typing its code. PR #18 lengthened codes to 10
characters to resist guessing. The owner preferred codes that are quick
to type, and accepted that a stranger might occasionally get in, as long
as the organizer could remove them.

## Decision

- Codes are **6 characters** from a **32-letter alphabet without
  look-alikes** (about 1.07 billion combinations).
- `join_club` allows **10 wrong codes per user per 15 minutes**
  (`join_attempts`), which makes guessing impractical.
- The organizer can **remove a member** with `remove_club_member`. The
  person is recorded in `club_removed_members` and can't rejoin with the
  code. Members can only delete their own membership directly; the owner
  can't remove themselves.

## Alternatives considered

- **10-character codes** — more secure, but annoying to share and type.
- **Invite links or email invites** — more machinery than a small club
  needs.

## Consequences

Codes stay friendly. An unwanted joiner is possible but rare, and the
organizer can fix it. A removed member can't currently be let back in
from the UI.
