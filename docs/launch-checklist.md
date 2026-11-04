# First release checklist

Everything between Margin as it is now (the owner and a few testers) and a
first release to real clubs. It comes from a production-readiness assessment
done on 2026-11-04 against the code, the live Supabase project and the
Vercel project.

## How to use this file

- Each item has an ID (`B1`, `S3`, `L2`) that stays the same. Mention it in
  PR titles or descriptions, e.g. "Upgrade Next.js (B1)".
- **Update this file in the same PR that does the work:** change the item's
  status in the table, add the PR number, and tick its "Done when" boxes.
  Settings changes made by hand get a short note instead of a PR number.
- Statuses: `todo`, `in progress`, `done`, `won't do` (say why in Notes).
- New problems found along the way get the next free ID in the right tier.
  Don't renumber existing items.
- When an item makes a significant decision, write an ADR too (see
  `docs/adr/`). Items marked **ADR** below are known to need one.

**Tiers.** **Blocker**: don't launch without it. **Should have**: within
the first few weeks after launch. **Later**: when there's time.

**Type.** **Code**: a PR. **Setting**: changed by hand in a dashboard.
**Decision**: the owner chooses.

**Effort.** S = an evening, M = a few evenings, L = more.

## Launch assumptions

The assessment assumed the following; revisit the plan if any change.

- **Who:** invite-only, 3–5 clubs of friends, about 40 people. *Unconfirmed.*
- **When:** no fixed date. *Unconfirmed.*
- **Budget:** free tiers, a domain at most. *Unconfirmed.*
- **Time:** one developer and operator, a few evenings a week. *Unconfirmed.*
- **Platforms:** web only. *Unconfirmed.*

## Status

Release readiness: **0 of 6 blockers done.**

### Blockers

| ID | Item | Type | Effort | Status | PR / notes |
|---|---|---|---|---|---|
| B1 | Upgrade Next.js off 16.3.0 (critical advisories) | Code | S | todo | |
| B2 | Custom SMTP for Supabase Auth | Setting, Decision | S–M | todo | |
| B3 | Email links that work in any browser (confirm sign-up and reset) | Setting | S | todo | |
| B4 | Backups, and one restore actually tested | Code | M | todo | |
| B5 | Account deletion | Code, Decision, **ADR** | M | todo | |
| B6 | Privacy page | Code, Decision | S | todo | |

### Should have

| ID | Item | Type | Effort | Status | PR / notes |
|---|---|---|---|---|---|
| S1 | Limit profile reads to people who share a club | Code | S | todo | |
| S2 | Error tracking, health route and uptime alerts | Code, Setting | M | todo | |
| S3 | Custom error and not-found pages | Code | S | todo | |
| S4 | A way to send feedback or report bugs | Code | S | todo | |
| S5 | Join links that pre-fill the code; fix the landing-page button | Code, **ADR** | M | todo | |
| S6 | Check Supabase Auth Site URL and redirect allowlist | Setting | S | todo | |
| S7 | Leaked-password protection | Setting, Decision | S | todo | |
| S8 | CI applies all migrations to a fresh database | Code | M | todo | |
| S9 | Set `GOOGLE_BOOKS_API_KEY` in Vercel | Setting | S | todo | |
| S10 | Dependency audit in CI, plus Dependabot | Code | S | todo | |
| S11 | Full walkthrough on a real phone, including accessibility | Manual check | S | todo | |

### Later

| ID | Item | Type | Effort | Status | PR / notes |
|---|---|---|---|---|---|
| L1 | Enforce the Content Security Policy | Code | M | todo | |
| L2 | Move `shadcn` to devDependencies | Code | S | todo | |
| L3 | Performance advisor fixes (RLS init plans, FK indexes) | Code | S | todo | |
| L4 | Revoke unneeded default table grants | Code | S | todo | |
| L5 | Stop syncing unused Supabase secrets to every Vercel environment | Setting | S | todo | |
| L6 | Bot protection on sign-up (only if sign-up goes public) | Code | M | todo | |
| L7 | Installable on phones (web app manifest) | Code | S–M | todo | |

## Suggested order

Each step is about one PR or one sitting of settings changes.

1. **B1, S10, L2.** Upgrade Next.js, add the audit to CI, and move `shadcn`.
2. **B2, B3, S6, S9.** Settings: SMTP, email templates, auth URLs, Books key
   (and a domain, if chosen).
3. **B4.** Nightly backup workflow, restore runbook, then one practice restore.
4. **B6, S3, S4.** Privacy page, error pages, feedback link.
5. **B5.** Account deletion, with its ADR.
6. **S1.** Profiles migration.
7. **S2.** Monitoring.
8. **S5.** Join links, with the ADR amending 0005.
9. **S8.** Migrations rehearsed in CI.
10. **S11.** Phone walkthrough, then invite the first clubs.
11. The Later items, as time allows.

## Open decisions

Answers here change the plan. Record the answer and the date when decided.

| # | Question | Affects | Answer |
|---|---|---|---|
| D1 | Who and when? Invite-only friends or open public sign-up? Public sign-up moves L6 to Should have and needs an ADR superseding the "small invite-only" assumption in ADR 0010. | L6, ADR 0010 | |
| D2 | Own a domain? Needed for Resend; also looks more trustworthy in emails than a `vercel.app` address. Gmail SMTP works without one. | B2 | |
| D3 | When an organizer deletes their account: block until they hand off the club, auto-transfer to the longest-standing member, or delete the club? | B5 | |
| D4 | Pay $25/month for Supabase Pro? It gives real backups and makes the keep-alive cron (ADR 0009) unnecessary. | B4, S7, ADR 0009 | |
| D5 | Is "add to home screen" part of the first release? | L7 | |

## Item details

### B1. Upgrade Next.js off 16.3.0

**Why:** production runs `next@16.3.0`. `pnpm audit --prod` reported
critical advisories (unauthenticated remote code execution, fixed in 16.3.3,
16.3.6 and 16.4.1) and a high-severity Server Actions denial of service
(fixed in 16.4.1). Most of the RCE paths likely don't apply here (image
optimization is off; no `use cache` or `next/og`), but the DoS does.

**Evidence:** `package.json:20`. Audit on 2026-11-04: 6 critical, 35 high.
The production deployment was `main` at `7ed1189`.

**Done when:**
- [ ] `next` is on the latest 16.4.x (16.4.5 at the time of writing), with
      the upgrade notes in `node_modules/next/dist/docs/` checked.
- [ ] `pnpm audit --prod` shows no critical or high advisory for `next`.
- [ ] Typecheck, tests and build pass; production redeployed.

### B2. Custom SMTP for Supabase Auth

**Why:** Supabase's built-in email only delivers to the project's team
members, a few per hour. Password reset and sign-up confirmation don't
reach anyone else. (Also tracked in the "Pending setup" note in `CLAUDE.md`.
Remove that note when this is done.)

**Options:** a dedicated Gmail account with an app password
(`smtp.gmail.com`, port 465), or Resend with an owned domain (see D2).

**Done when:**
- [ ] SMTP configured in Supabase Auth.
- [ ] A reset email and a confirmation email reach an address that isn't a
      Supabase team member.
- [ ] The "Pending setup" note is removed from `CLAUDE.md`.

### B3. Email links that work in any browser

**Why:** sign-up confirmation goes through `/auth/callback`, which only
works in the browser that asked for the email. Someone who signs up on a
laptop and taps the link on their phone gets "That link didn't work".
`/auth/confirm` already handles token-hash links that work anywhere.

**Evidence:** `app/auth/actions.ts:63`, `app/auth/confirm/route.ts`.

**Done when:**
- [ ] Reset Password template links to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`.
- [ ] Confirm signup template links to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/clubs`.
- [ ] Both tested by opening the email on a different device.

### B4. Backups, and one restore actually tested

**Why:** the Supabase organization is on the Free plan, and nothing in the
repo exports the database. A bad hand-run migration or an accidental club
deletion can't be undone. (That Free has no restorable dashboard backups is
inferred from Supabase's plan docs: confirm under Database → Backups.)

**Evidence:** `get_organization` → `plan: free`;
`.github/workflows/ci.yml` only runs checks.

**Done when:**
- [ ] A scheduled GitHub Action runs `pg_dump` nightly, covering `public`
      and `auth.users`, and keeps encrypted dumps for at least 14 days.
- [ ] A short restore runbook exists (e.g. `docs/restore.md`).
- [ ] One restore into a throwaway database has been done, and its date is
      noted here. (The Free org allows two active projects, both in use, so
      local Postgres or a CI job is the likely target.)
- [ ] The migration routine in `CLAUDE.md` says to take a dump first.

### B5. Account deletion

**Why:** people need to be able to leave the app entirely. There's a trap:
`clubs.owner_id` references `auth.users` with `on delete cascade`, so
deleting an organizer's account would delete their whole club for every
member.

**Approach:** a `SECURITY DEFINER` function such as `delete_my_account()`,
consistent with ADR 0003 (no service-role key in the app). The organizer
rule comes from D3.

**Evidence:** `app/settings/page.tsx` has no delete option; foreign key
`clubs_owner_id_fkey` cascades.

**Done when:**
- [ ] D3 is decided and recorded in an ADR.
- [ ] Migration with the function and its revoke/grant block, applied and
      verified on the live database.
- [ ] Settings has a confirmed "Delete account" action.
- [ ] Deleting a non-organizer leaves their clubs, past vote results and
      other members' data intact.

### B6. Privacy page

**Why:** the app stores emails, password hashes (in Supabase), display
names, club membership, nominations, named votes and ratings, plus
Supabase auth logs with IP addresses and cookieless Vercel Analytics. People
outside the friend group deserve a plain statement of that.

**Done when:**
- [ ] `/privacy` explains what's stored, why, who can see it (club members
      see names, ballots stay private, ratings are named), the services
      used (Supabase, Vercel, Google Books, Open Library), and how to
      delete an account.
- [ ] Linked from the landing page footer and the sign-up page.
- [ ] Terms decided: a short page, or none (record which).

### S1. Limit profile reads to people who share a club

**Why:** any signed-in user can read every profile in the app. The default
display name is the part of the email before the `@`, so this leaks part of
everyone's email across clubs.

**Evidence:** `profiles_select … using (true)` in
`supabase/migrations/20260822060358_bookclub_rls_and_rpcs.sql:41`;
`handle_new_user` uses `split_part(email, '@', 1)`.

**Done when:**
- [ ] Policy allows your own profile and profiles of people in a club with
      you (consider removed members shown in organizer settings).
- [ ] Migration applied and verified; member lists, ballots and ratings
      still show names.

### S2. Error tracking, health route and uptime alerts

**Why:** Vercel Hobby keeps runtime logs for one hour, and there's no error
tracking or alerting. If the keep-alive cron starts failing, the 503 is gone
before anyone looks, and Supabase pauses the project a week later. This is
for alerting, so it doesn't reverse ADR 0009.

**Done when:**
- [ ] Error tracking (e.g. Sentry free tier) on server and client.
- [ ] `/api/health` checks the database.
- [ ] A free uptime monitor checks it and emails the owner on failure.

### S3. Custom error and not-found pages

**Why:** there's no `app/error.tsx`, `app/global-error.tsx` or
`app/not-found.tsx`, so failures show Next.js defaults.

**Done when:**
- [ ] All three exist, match the app's style, and offer a way back.

### S4. A way to send feedback or report bugs

**Done when:**
- [ ] A feedback link (email or form) in the landing footer and Settings.

### S5. Join links that pre-fill the code

**Why:** today an invitee signs up, confirms, signs in, then finds the
"Join a club" tab and types the code. "Join with a code" on the landing page
sends signed-out visitors to sign-in, not sign-up (`app/page.tsx:69`). ADR
0005 rejected "invite links", so this needs an ADR amending it. The code
stays the secret, so the security model doesn't change.

**Done when:**
- [ ] ADR written.
- [ ] `/join/[code]` pre-fills the code and survives sign-up and
      confirmation.
- [ ] The organizer can copy the link next to the code.
- [ ] Landing button fixed.

### S6. Check Supabase Auth Site URL and redirect allowlist

**Why:** email links are built from the request's `Origin` header
(`app/auth/actions.ts:93-99`). The redirect allowlist is the only thing that
keeps a forged origin out of reset emails. Not verified: no tool exposes
these settings.

**Done when:**
- [ ] Site URL is the production domain.
- [ ] The allowlist has no broad wildcard like `https://*.vercel.app/**`.

### S7. Leaked-password protection

**Why:** flagged by the Supabase security advisor. It may need the Pro plan
(see D4).

**Done when:**
- [ ] Enabled, or recorded here as `won't do` with the reason.

### S8. CI applies all migrations to a fresh database

**Why:** migrations are pasted by hand into production with no rehearsal.
They were in sync on 2026-11-04 (13 of 13), but a broken one would only show
up live.

**Done when:**
- [ ] A CI job starts Postgres (or the Supabase CLI) and applies every file
      in `supabase/migrations/` in order.

### S9. Set `GOOGLE_BOOKS_API_KEY` in Vercel

**Why:** not set, so search uses Google's shared anonymous quota and can
fail with "Couldn't load that book's details" (ADR 0010).

**Done when:**
- [ ] Key created, restricted to the Books API, and set for Production.

### S10. Dependency audit in CI, plus Dependabot

**Why:** this is how B1 went unnoticed.

**Done when:**
- [ ] CI runs `pnpm audit --prod --audit-level=high`.
- [ ] Dependabot (or similar) opens update PRs.

### S11. Full walkthrough on a real phone

**Why:** not yet checked by hand. Accessibility markup looks considered (43
`aria-`/`sr-only` uses), but the flow hasn't been tested end to end on a
phone or with a screen reader.

**Done when:**
- [ ] Sign up, confirm, join, nominate, rank, close the vote, rate: all done
      on a phone with a new account.
- [ ] Problems found are added here as new items.

### L1. Enforce the Content Security Policy

**Why:** the policy is report-only with no report endpoint, so it does
nothing (`next.config.mjs:20`). See
`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.

### L2. Move `shadcn` to devDependencies

**Why:** it's a CLI, used here only for its CSS (`app/globals.css:3`), but
it pulls in about 70 of the audit findings.

### L3. Performance advisor fixes

**Why:** 13 RLS policies re-evaluate `auth.uid()` per row and 14 foreign
keys have no index. Not noticeable at 40 users.

### L4. Revoke unneeded default table grants

**Why:** `anon` and `authenticated` hold Supabase's default grants (including
TRUNCATE) on most tables. Not reachable through the REST API, but tidier
revoked.

### L5. Stop syncing unused Supabase secrets to every Vercel environment

**Why:** the Supabase integration syncs the service-role key, JWT secret and
Postgres password to Production, Preview and Development. The app uses none
of them.

### L6. Bot protection on sign-up

**Why:** only needed if sign-up goes public (D1). The join-code rate limit
(10 wrong codes per user per 15 minutes) is already sound.

### L7. Installable on phones

**Why:** there's no web app manifest. Depends on D5.

## Cost at launch size

At about 40 people, roughly $1/month: a domain at about $12/year if one is
bought. Supabase Free (database 12 MB of 500 MB on 2026-11-04), Vercel Hobby
(non-commercial use only), Resend Free (3,000 emails/month) or Gmail SMTP,
and free tiers of error tracking and uptime monitoring all cover it. What
would raise it: Supabase Pro ($25/month, see D4), or charging money, which
takes the app off Vercel Hobby.

## Already in place

Verified on 2026-11-04, for reference:

- Row-level security on every table; rule-bearing writes go through
  `SECURITY DEFINER` functions with `search_path = ''`, none callable by
  `anon` (ADR 0003).
- All 13 repo migrations applied on the live database, none extra.
- Typecheck, 40 unit tests and the build pass; CI runs all three.
- The keep-alive cron runs daily and reaches the database (Supabase edge
  logs show its three queries in the 12:00 UTC hour on 2026-11-03).
- Join codes are rate limited per user (ADR 0005).
- Ballots are private to their voter; book rows are validated by database
  constraints (ADR 0010).
- Security headers set: HSTS, `nosniff`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
