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
