import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { BookCover } from "@/components/books/book-cover"
import { NominateBookDialog } from "@/components/books/nominate-book-dialog"
import { CandidateList } from "@/components/clubs/candidate-list"
import { ClubSettingsDialog } from "@/components/clubs/club-settings-dialog"
import { CloseVotingButton, FinishReadButton, StartVotingButton } from "@/components/clubs/organizer-controls"
import { CarryOver, type CarryOverBook } from "@/components/reads/carry-over"
import { PastReads } from "@/components/reads/past-reads"
import { ReadDates } from "@/components/reads/read-dates"
import { ReadDatesDialog } from "@/components/reads/read-dates-dialog"
import { RatingPrompt } from "@/components/reads/rating-prompt"
import { RankedBallot } from "@/components/voting/ranked-ballot"
import { RoundResults } from "@/components/voting/round-results"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { averageRating } from "@/lib/reads"
import { createClient } from "@/lib/supabase/server"
import type { Book, Candidate, Club, Read, VotingSession } from "@/lib/types"

const BOOK_FIELDS =
  "id, source_id, title, authors, description, categories, cover_image_url, published_date, page_count"

const STAGE_LABEL: Record<string, string> = {
  nominating: "Nominating",
  voting: "Voting",
  up_next: "Up next",
}

type Member = { user_id: string; profiles: { display_name: string | null } | null }
type CandidateRow = Candidate & { read_id: string }
type SessionRow = VotingSession & { read_id: string }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.24em] text-primary">{children}</p>
}

function ReadDetailsLink({ clubId, number }: { clubId: string; number: number }) {
  return (
    <Link
      href={`/clubs/${clubId}/reads/${number}`}
      className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
    >
      Nominations, vote, and details
    </Link>
  )
}

function VoteResults({ session, booksById }: { session: SessionRow; booksById: Map<string, Book> }) {
  if (!session.results) return null
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline">
        How the vote went
      </summary>
      <div className="pt-4">
        <RoundResults results={session.results} booksById={booksById} winner={undefined} />
      </div>
    </details>
  )
}

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

  const [{ data: readRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("reads")
      .select(`id, club_id, number, status, book_id, start_date, discussion_date, finished_at, books(${BOOK_FIELDS})`)
      .eq("club_id", clubId)
      .order("number", { ascending: false }),
    supabase.from("club_members").select("user_id, profiles(display_name)").eq("club_id", clubId),
  ])

  const reads = (readRows ?? []) as unknown as Read[]
  const members = (memberRows ?? []) as unknown as Member[]
  const currentRead = reads.find((read) => read.status === "current") ?? null
  const nextRead = reads.find((read) => ["nominating", "voting", "up_next"].includes(read.status)) ?? null
  const pastReads = reads
    .filter((read) => read.status === "finished")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? "") || b.number - a.number)
  // While nominating, the previous read's non-winners can be carried over.
  const previousRead =
    nextRead?.status === "nominating" ? (reads.find((read) => read.number === nextRead.number - 1) ?? null) : null

  const sessionReadIds = [currentRead?.id, nextRead?.id].filter((id): id is string => Boolean(id))
  const candidateReadIds = [nextRead?.status === "up_next" ? null : nextRead?.id, previousRead?.id].filter(
    (id): id is string => Boolean(id),
  )
  const pastReadIds = pastReads.map((read) => read.id)

  const [{ data: sessionRows }, { data: candidateRows }, { data: ratingRows }] = await Promise.all([
    sessionReadIds.length
      ? supabase.from("voting_sessions").select("*").in("read_id", sessionReadIds)
      : Promise.resolve({ data: [] }),
    candidateReadIds.length
      ? supabase
          .from("club_candidate_books")
          .select(`id, club_id, read_id, book_id, added_by, added_at, books(${BOOK_FIELDS}), profiles(display_name)`)
          .in("read_id", candidateReadIds)
          .order("added_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    pastReadIds.length
      ? supabase.from("read_ratings").select("read_id, user_id, score_halves").in("read_id", pastReadIds)
      : Promise.resolve({ data: [] }),
  ])

  const sessions = (sessionRows ?? []) as SessionRow[]
  const currentSession = sessions.find((session) => session.read_id === currentRead?.id) ?? null
  const nextSession = sessions.find((session) => session.read_id === nextRead?.id) ?? null
  const activeSession = nextRead?.status === "voting" && nextSession?.status === "active" ? nextSession : null

  // Nominations for the next read, and what can be carried over into it.
  const allCandidates = (candidateRows ?? []) as unknown as CandidateRow[]
  const candidates = allCandidates.filter((candidate) => candidate.read_id === nextRead?.id)
  const myNominationCount = candidates.filter((candidate) => candidate.added_by === user.id).length
  const remainingNominations = Math.max(0, club.max_nominations_per_member - myNominationCount)
  const nominatedBookIds = new Set(candidates.map((candidate) => candidate.book_id))
  const carryOver: CarryOverBook[] = allCandidates
    .filter(
      (candidate) =>
        candidate.read_id === previousRead?.id &&
        candidate.book_id !== previousRead?.book_id &&
        !nominatedBookIds.has(candidate.book_id),
    )
    .map((candidate) => ({
      bookId: candidate.book_id,
      title: candidate.books.title,
      nominatedBy: candidate.profiles?.display_name ?? null,
      mine: candidate.added_by === user.id,
    }))

  // Club averages for past reads.
  const scoresByRead = new Map<string, number[]>()
  const ratedByMe = new Set<string>()
  for (const row of (ratingRows ?? []) as { read_id: string; user_id: string; score_halves: number }[]) {
    scoresByRead.set(row.read_id, [...(scoresByRead.get(row.read_id) ?? []), row.score_halves])
    if (row.user_id === user.id) ratedByMe.add(row.read_id)
  }
  // Prompt for the most recently finished read until this member rates it.
  const readToRate = pastReads[0] && !ratedByMe.has(pastReads[0].id) ? pastReads[0] : null
  const averages: Record<string, number> = {}
  for (const [readId, scores] of scoresByRead) {
    const average = averageRating(scores)
    if (average !== null) averages[readId] = average
  }

  // Books on the open ballot, plus every book named in vote results.
  let ballotBooks: Book[] = []
  let hasVoted = false
  let ballotCount = 0
  const booksById = new Map<string, Book>()

  if (sessions.length) {
    const [{ data: sessionBookRows }, myVote, ballots] = await Promise.all([
      supabase
        .from("voting_session_books")
        .select(`voting_session_id, books(${BOOK_FIELDS})`)
        .in(
          "voting_session_id",
          sessions.map((session) => session.id),
        ),
      activeSession
        ? supabase
            .from("votes")
            .select("id")
            .eq("voting_session_id", activeSession.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      activeSession
        ? supabase
            .from("votes")
            .select("id", { count: "exact", head: true })
            .eq("voting_session_id", activeSession.id)
        : Promise.resolve({ count: 0 }),
    ])

    const rows = ((sessionBookRows ?? []) as unknown as { voting_session_id: string; books: Book | null }[]).filter(
      (row): row is { voting_session_id: string; books: Book } => Boolean(row.books),
    )
    for (const row of rows) booksById.set(row.books.id, row.books)
    ballotBooks = activeSession
      ? rows.filter((row) => row.voting_session_id === activeSession.id).map((row) => row.books)
      : []
    hasVoted = Boolean(myVote.data)
    ballotCount = ballots.count ?? 0
  }

  const reopenableId = isOwner && !currentRead && pastReads[0] ? pastReads[0].id : null

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
        <ClubSettingsDialog
          clubId={club.id}
          clubName={club.name}
          joinCode={club.join_code}
          members={members}
          ownerId={club.owner_id}
          isOwner={isOwner}
        />
      </header>

      <div className="flex flex-col gap-2">
        <SectionLabel>
          {members.length} {members.length === 1 ? "member" : "members"}
        </SectionLabel>
        <h1 className="font-serif text-4xl leading-tight text-balance">{club.name}</h1>
      </div>

      {readToRate ? (
        <RatingPrompt
          clubId={club.id}
          readId={readToRate.id}
          readNumber={readToRate.number}
          title={readToRate.books?.title ?? `read #${readToRate.number}`}
        />
      ) : null}

      {/* Current read */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <SectionLabel>Current read{currentRead ? ` · #${currentRead.number}` : ""}</SectionLabel>

        {currentRead ? (
          <>
            <div className="flex gap-4">
              <BookCover
                src={currentRead.books?.cover_image_url ?? null}
                title={currentRead.books?.title ?? "?"}
                className="w-20"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-2xl leading-tight text-pretty">
                    {currentRead.books?.title ?? "Unknown book"}
                  </h2>
                  {currentRead.books?.authors.length ? (
                    <p className="text-sm text-muted-foreground">{currentRead.books.authors.join(", ")}</p>
                  ) : null}
                </div>
                <ReadDates
                  startDate={currentRead.start_date}
                  discussionDate={currentRead.discussion_date}
                  showProgress
                />
              </div>
            </div>

            {isOwner ? (
              <div className="flex flex-wrap gap-2">
                <ReadDatesDialog
                  clubId={club.id}
                  readId={currentRead.id}
                  readNumber={currentRead.number}
                  startDate={currentRead.start_date}
                  discussionDate={currentRead.discussion_date}
                  triggerLabel={currentRead.start_date || currentRead.discussion_date ? "Edit dates" : "Set dates"}
                />
                <FinishReadButton
                  clubId={club.id}
                  readId={currentRead.id}
                  title={currentRead.books?.title ?? "this book"}
                  upNextTitle={nextRead?.status === "up_next" ? nextRead.books?.title : undefined}
                />
              </div>
            ) : null}

            {currentSession ? <VoteResults session={currentSession} booksById={booksById} /> : null}
            <ReadDetailsLink clubId={club.id} number={currentRead.number} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing is being read right now.</p>
        )}
      </section>

      {/* Next read */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>
            Next read{nextRead ? ` · #${nextRead.number} · ${STAGE_LABEL[nextRead.status]}` : ""}
          </SectionLabel>
          {activeSession ? (
            <Badge variant="secondary">
              {ballotCount} of {members.length} voted
            </Badge>
          ) : null}
        </div>

        {!nextRead ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isOwner
                ? "Open the next read to start collecting nominations. You can set its dates now or later."
                : "The next read isn’t open yet. Nominating a book opens it."}
            </p>
            <div className="flex flex-wrap gap-2">
              {isOwner ? (
                <ReadDatesDialog clubId={club.id} triggerLabel="Start next read" triggerVariant="default" />
              ) : null}
              <NominateBookDialog clubId={club.id} />
            </div>
          </div>
        ) : null}

        {nextRead && nextRead.status !== "up_next" ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ReadDates startDate={nextRead.start_date} discussionDate={nextRead.discussion_date} />
            {isOwner ? (
              <ReadDatesDialog
                clubId={club.id}
                readId={nextRead.id}
                readNumber={nextRead.number}
                startDate={nextRead.start_date}
                discussionDate={nextRead.discussion_date}
                triggerLabel={nextRead.start_date || nextRead.discussion_date ? "Edit dates" : "Set dates"}
                triggerVariant="ghost"
              />
            ) : null}
          </div>
        ) : null}

        {nextRead?.status === "nominating" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                You’ve nominated {myNominationCount} of {club.max_nominations_per_member}
              </p>
              <NominateBookDialog clubId={club.id} disabled={remainingNominations === 0} />
            </div>

            {previousRead ? (
              <CarryOver
                clubId={club.id}
                previousReadNumber={previousRead.number}
                books={carryOver}
                remaining={remainingNominations}
              />
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
                locked={false}
              />
            )}

            {isOwner ? (
              <div className="flex flex-col gap-2">
                <StartVotingButton clubId={club.id} disabled={candidates.length < 2} />
                {candidates.length < 2 ? (
                  <p className="text-xs text-muted-foreground">Two nominations are needed before a vote can open.</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {activeSession ? (
          <>
            {hasVoted ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your ballot is in. Results appear once the organizer closes the vote.
              </p>
            ) : (
              <RankedBallot clubId={club.id} sessionId={activeSession.id} books={ballotBooks} />
            )}
            {isOwner ? <CloseVotingButton clubId={club.id} sessionId={activeSession.id} /> : null}
          </>
        ) : null}

        {nextRead?.status === "up_next" ? (
          <>
            <div className="flex gap-4">
              <BookCover
                src={nextRead.books?.cover_image_url ?? null}
                title={nextRead.books?.title ?? "?"}
                className="w-16"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-xl leading-tight text-pretty">
                    {nextRead.books?.title ?? "Unknown book"}
                  </h3>
                  {nextRead.books?.authors.length ? (
                    <p className="text-sm text-muted-foreground">{nextRead.books.authors.join(", ")}</p>
                  ) : null}
                </div>
                <ReadDates startDate={nextRead.start_date} discussionDate={nextRead.discussion_date} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Won the vote. It becomes the current read when
              {currentRead?.books?.title ? ` “${currentRead.books.title}”` : " the current read"} is marked finished.
            </p>
            {isOwner ? (
              <div>
                <ReadDatesDialog
                  clubId={club.id}
                  readId={nextRead.id}
                  readNumber={nextRead.number}
                  startDate={nextRead.start_date}
                  discussionDate={nextRead.discussion_date}
                  triggerLabel={nextRead.start_date || nextRead.discussion_date ? "Edit dates" : "Set dates"}
                />
              </div>
            ) : null}
            {nextSession ? <VoteResults session={nextSession} booksById={booksById} /> : null}
            <ReadDetailsLink clubId={club.id} number={nextRead.number} />
          </>
        ) : null}
      </section>

      {/* Past reads */}
      {pastReads.length ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <SectionLabel>Past reads</SectionLabel>
          <PastReads clubId={club.id} reads={pastReads} averages={averages} reopenableId={reopenableId} />
        </section>
      ) : null}
    </main>
  )
}
