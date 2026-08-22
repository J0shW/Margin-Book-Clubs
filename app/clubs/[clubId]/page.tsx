import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { NominateBookDialog } from "@/components/books/nominate-book-dialog"
import { CandidateList } from "@/components/clubs/candidate-list"
import { JoinCode } from "@/components/clubs/join-code"
import { CloseVotingButton, LeaveClubButton, StartVotingButton } from "@/components/clubs/organizer-controls"
import { RankedBallot } from "@/components/voting/ranked-ballot"
import { RoundResults } from "@/components/voting/round-results"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/server"
import type { Book, Candidate, Club, VotingSession } from "@/lib/types"

const BOOK_FIELDS =
  "id, source_id, title, authors, description, categories, cover_image_url, published_date, page_count"

export default async function ClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: club } = await supabase.from("clubs").select("*").eq("id", clubId).maybeSingle<Club>()
  if (!club) notFound()

  const isOwner = club.owner_id === user.id

  const [{ data: candidateRows }, { data: memberRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from("club_candidate_books")
      .select(`id, club_id, book_id, added_by, added_at, books(${BOOK_FIELDS})`)
      .eq("club_id", clubId)
      .order("added_at", { ascending: true }),
    supabase.from("club_members").select("user_id, profiles(display_name)").eq("club_id", clubId),
    supabase
      .from("voting_sessions")
      .select("*")
      .eq("club_id", clubId)
      .order("started_at", { ascending: false })
      .limit(1),
  ])

  const candidates = (candidateRows ?? []) as unknown as Candidate[]
  const members = (memberRows ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[]
  const session = (sessionRows?.[0] ?? null) as VotingSession | null
  const activeSession = session?.status === "active" ? session : null
  const completedSession = session?.status === "completed" ? session : null

  // Books in the active/last round plus the winner, for ballot + results rendering.
  let sessionBooks: Book[] = []
  let hasVoted = false
  let ballotCount = 0

  if (session) {
    const [{ data: sessionBookRows }, { data: myVote }, { count }] = await Promise.all([
      supabase
        .from("voting_session_books")
        .select(`book_id, books(${BOOK_FIELDS})`)
        .eq("voting_session_id", session.id),
      supabase
        .from("votes")
        .select("id")
        .eq("voting_session_id", session.id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("votes")
        .select("id", { count: "exact", head: true })
        .eq("voting_session_id", session.id),
    ])

    sessionBooks = ((sessionBookRows ?? []) as unknown as { books: Book }[]).map((r) => r.books).filter(Boolean)
    hasVoted = Boolean(myVote)
    ballotCount = count ?? 0
  }

  const booksById = new Map<string, Book>(sessionBooks.map((b) => [b.id, b]))
  for (const candidate of candidates) booksById.set(candidate.books.id, candidate.books)

  const currentBook = club.current_book_id ? booksById.get(club.current_book_id) : undefined

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-5 pb-16 pt-10">
      <header className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/clubs">
              <ArrowLeftIcon data-icon="inline-start" />
              Clubs
            </Link>
          }
        />
        {isOwner ? null : <LeaveClubButton clubId={club.id} />}
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
          <h1 className="font-serif text-4xl leading-tight text-balance">{club.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Join code</span>
          <JoinCode code={club.join_code} />
        </div>
      </section>

      {activeSession ? (
        <section className="flex flex-col gap-5 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Voting is open</h2>
            <Badge variant="secondary">
              {ballotCount} of {members.length} voted
            </Badge>
          </div>

          {hasVoted ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your ballot is in. Results appear once the organizer closes the round.
            </p>
          ) : (
            <RankedBallot clubId={club.id} sessionId={activeSession.id} books={sessionBooks} />
          )}

          {isOwner ? <CloseVotingButton clubId={club.id} sessionId={activeSession.id} /> : null}
        </section>
      ) : null}

      {completedSession?.results ? (
        <section className="flex flex-col gap-5 border-t border-border pt-8">
          <h2 className="font-serif text-2xl">Last round&apos;s results</h2>
          <RoundResults results={completedSession.results} booksById={booksById} winner={currentBook} />
        </section>
      ) : null}

      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">
            Shortlist
            <span className="ml-2 font-sans text-sm text-muted-foreground">{candidates.length}</span>
          </h2>
          <NominateBookDialog clubId={club.id} disabled={Boolean(activeSession)} />
        </div>

        {activeSession ? (
          <p className="text-sm text-muted-foreground">
            The shortlist is locked while a vote is running.
          </p>
        ) : null}

        {candidates.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing nominated yet</EmptyTitle>
              <EmptyDescription>Search by title or author and add the first candidate.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <CandidateList
            clubId={club.id}
            candidates={candidates}
            currentUserId={user.id}
            isOwner={isOwner}
            locked={Boolean(activeSession)}
          />
        )}

        {isOwner && !activeSession ? (
          <StartVotingButton clubId={club.id} disabled={candidates.length < 2} />
        ) : null}
        {isOwner && !activeSession && candidates.length < 2 ? (
          <p className="text-xs text-muted-foreground">Two nominations are needed before a vote can open.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="font-serif text-2xl">Members</h2>
        <ul className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li key={member.user_id}>
              <Badge variant={member.user_id === club.owner_id ? "default" : "outline"}>
                {member.profiles?.display_name ?? "Member"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
