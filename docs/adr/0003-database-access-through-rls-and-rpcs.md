# 0003. Database access goes through RLS and validated RPCs

- **Status:** Accepted
- **Date:** 2026-10-12
- **Related:** PR #18, `supabase/migrations/20261012120000_harden_rls_and_join_codes.sql`

## Context

The browser talks to Supabase with the public anon key, so anything the
REST API allows, any signed-in user can do directly, bypassing the app's
server actions. A review found direct-insert policies on voting tables
that let a client skip ballot validation, and that Supabase grants
EXECUTE on every new function to `anon` by default, so a
`revoke ... from public` left functions callable while signed out.
The schema had also only existed in the Supabase dashboard.

## Decision

- **Row level security on every table.** Reads are limited to club
  members via `is_club_member` / `is_club_owner`.
- **Multi-step or rule-bearing writes go through `SECURITY DEFINER`
  functions** (`start_voting_session`, `submit_ballot`,
  `close_voting_session`, `resolve_vote_tie`, `finish_read`,
  `remove_club_member`, `join_club`, ...). Their tables have no direct
  insert/update policy for those operations. Each function checks the
  caller, uses `set search_path = ''`, and schema-qualifies everything.
- **Grants are explicit.** Every function is revoked from `anon` and
  `public`; user-facing ones are granted to `authenticated`; internal
  helpers (e.g. `tally_consensus`, `complete_voting_session`) are granted
  to no one.
- **The schema is versioned in `supabase/migrations/`.** Each change is
  a new timestamped migration file. It is applied in the Supabase SQL
  Editor along with a row in `supabase_migrations.schema_migrations`,
  and then verified read-only (the Supabase MCP connector times out on
  DDL).

## Alternatives considered

- **Do all writes in Next server actions with the service-role key** —
  puts every rule in app code, and one forgotten check exposes all data.
- **Plain RLS policies for everything** — fine for simple rows, but rules
  like "one open vote per club" or "ballot must rank only this vote's
  books" are clearer and safer as functions.

## Consequences

The database enforces the rules even if the UI is bypassed. Supabase's
advisor warns that signed-in users can execute `SECURITY DEFINER`
functions; that's expected for the user-facing RPCs, and each one
checks permissions itself. New functions must remember the revoke/grant
block, and migrations need a manual run in the SQL Editor.
