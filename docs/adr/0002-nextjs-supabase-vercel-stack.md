# 0002. Next.js on Vercel with Supabase for data and auth

- **Status:** Accepted
- **Date:** 2026-08-22
- **Related:** initial v0 scaffold

## Context

Margin is a small app for book clubs, built and maintained by one person
with AI help. It needs sign-in, a relational database with per-club
access rules, and cheap hosting.

## Decision

- **Next.js App Router** (currently 16.x) with React Server Components
  and server actions in `app/clubs/actions.ts` for mutations. Next 16 has
  breaking changes from older versions; read `node_modules/next/dist/docs/`
  before writing Next code (see `AGENTS.md`).
- **Supabase** for Postgres and auth, accessed through `@supabase/ssr`
  (`lib/supabase/server.ts`, `lib/supabase/client.ts`, and `proxy.ts` with
  `lib/supabase/proxy.ts` for session refresh and the sign-in redirect).
- **Vercel** for hosting (project `book-club-tracker`), including cron.
- UI built from shadcn components on Base UI, Tailwind v4, pnpm,
  vitest for unit tests.

## Alternatives considered

- **Self-hosted Postgres plus a custom auth library** — more to run and
  secure for no benefit at this size.

## Consequences

Both platforms' free plans cover the app, with one catch: Supabase pauses
idle free projects (see [0009](0009-supabase-keep-alive-cron.md)).
Authorization lives in the database rather than the Next server (see
[0003](0003-database-access-through-rls-and-rpcs.md)).
