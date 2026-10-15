@AGENTS.md

# Decision records

Significant decisions are recorded in `docs/adr/` (index in
`docs/adr/README.md`). Check the relevant ADR before changing voting,
reads, ratings, join codes, database access rules, or book search, and
don't quietly reverse one. When a change makes a new significant
decision, use the `adr` skill to add a record in the same PR.

# Database migrations

The owner runs migrations by hand in the Supabase SQL Editor. Whenever a
change adds a migration, put the whole thing in one fenced `sql` code block
in your reply, ready to paste, ending with its history row:
`insert into supabase_migrations.schema_migrations (version, name) values ('<timestamp>', '<name>');`
Then verify it on the live database with read-only queries once they've run it.

# Pending setup (remind the owner)

- **Custom SMTP for Supabase Auth is not set up yet.** Supabase's built-in
  email only delivers to the project's team members (a few per hour), so
  password reset and other auth emails don't reach other club members.
  Options: a dedicated Gmail account with an app password
  (`smtp.gmail.com`, port 465) or Resend with an owned domain. Once it's
  set up, switch the Reset Password email template to link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  so reset links work in any browser. Remind the owner at the start of new
  work, and before building email notifications, which need it too. Remove
  this note once it's done.
