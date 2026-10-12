# Architecture decision records

Significant decisions about Margin and why we made them. Each record is
short: context, decision, alternatives, consequences. To change a
decision, add a new ADR that supersedes the old one rather than editing
it. New records use [`template.md`](template.md); the `adr` skill in
`.claude/skills/adr/` explains when and how to write one.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-nextjs-supabase-vercel-stack.md) | Next.js on Vercel with Supabase for data and auth | Accepted |
| [0003](0003-database-access-through-rls-and-rpcs.md) | Database access goes through RLS and validated RPCs | Accepted |
| [0004](0004-book-search-title-author-english.md) | Book search matches title and author, in English, with prefix matching | Accepted |
| [0005](0005-short-join-codes-and-member-removal.md) | Six-character join codes, with rate limiting and organizer removal | Accepted |
| [0006](0006-reads-lifecycle.md) | Organize a club around reads with a fixed lifecycle | Accepted |
| [0007](0007-half-point-ratings.md) | Rate finished reads from 0.5 to 10 in half points | Accepted |
| [0008](0008-consensus-voting.md) | Count ranked ballots by consensus points by default | Accepted |
| [0009](0009-supabase-keep-alive-cron.md) | Keep Supabase awake with a daily Vercel cron | Accepted |
