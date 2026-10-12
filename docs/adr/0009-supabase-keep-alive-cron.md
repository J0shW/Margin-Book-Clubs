# 0009. Keep Supabase awake with a daily Vercel cron

- **Status:** Accepted
- **Date:** 2026-10-12
- **Related:** PR #23; `app/api/keep-alive/route.ts`, `vercel.json`

## Context

Supabase pauses Free plan projects after about a week without enough
database activity. A club that goes quiet between meetings would come
back to a broken site until someone restored the project by hand.

## Decision

A daily Vercel cron (`17 12 * * *` UTC) calls `/api/keep-alive`, which
runs three cheap count queries as the anon role. RLS returns no rows,
but the queries still count as activity. The route requires Vercel's
`Authorization: Bearer $CRON_SECRET` header, returns 503 on failure so it
shows in the cron logs, and is exempt from the sign-in redirect in
`lib/supabase/proxy.ts`.

## Alternatives considered

- **Upgrade to a paid Supabase plan** — costs money for a tiny app.
- **An external uptime pinger** — another account to manage, and it
  would need to hit a route that touches the database anyway.

## Consequences

The project stays active for free. `CRON_SECRET` must be set in Vercel.
If the route starts failing, the project may pause again, so check the
cron logs if the site goes down.
