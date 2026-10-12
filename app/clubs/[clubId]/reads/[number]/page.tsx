import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon, StarIcon, TrophyIcon } from "lucide-react"
import { BookCover } from "@/components/books/book-cover"
import { BookDetailsDialog } from "@/components/books/book-details-dialog"
import { ReadDates } from "@/components/reads/read-dates"
import { RatingDialog } from "@/components/reads/rating-dialog"
import { VoteResults } from "@/components/voting/vote-results"
import { Button } from "@/components/ui/button"
import { averageRating, formatRating, formatReadMonth } from "@/lib/reads"
import { createClient } from "@/lib/supabase/server"
import type { Book, Candidate, Read, VotingSession } from "@/lib/types"

const BOOK_FIELDS =
  "id, source_id, title, authors, description, categories, cover_image_url, published_date, page_count"

type RatingRow = { user_id: string; score_halves: number; profiles: { display_name: string | null } | null }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-[0.24em] text-primary">{children}</h2>
}

function statusLabel(read: Read): string {
  switch (read.status) {
    case "nominating":
      return "Taking nominations"
    case "voting":
      return "Voting"
    case "up_next":
      return "Up next"
    case "current":
      return "Current read"
    case "finished":
      return read.finished_at ? `Finished ${formatReadMonth(new Date(read.finished_at))}` : "Finished"
  }
}

export default async function ReadPage({ params }: { params: Promise<{ clubId: string; number: string }> }) {
  const { clubId, number } = await params
  const readNumber = Number(number)
  if (!Number.isInteger(readNumber) || readNumber < 1) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // RLS limits both to members, so a non-member gets a 404 here.
  const [{ data: club }, { data: readRow }] = await Promise.all([
    supabase.from("clubs").select("id, name").eq("id", clubId).maybeSingle<{ id: string; name: string }>(),
    supabase
      .from("reads")
      .select(`id, club_id, number, status, book_id, start_date, discussion_date, finished_at, books(${BOOK_FIELDS})`)
      .eq("club_id", clubId)
      .eq("number", readNumber)
      .maybeSingle(),
  ])
  if (!club || !readRow) notFound()
  const read = readRow as unknown as Read

  const [{ data: candidateRows }, { data: sessionRow }, { data: ratingRows }, { count: memberCount }] =
    await Promise.all([
      supabase
        .from("club_candidate_books")
        .select(`id, club_id, book_id, added_by, added_at, books(${BOOK_FIELDS}), profiles(display_name)`)
        .eq("read_id", read.id)
        .order("added_at", { ascending: true }),
      supabase.from("voting_sessions").select("*").eq("read_id", read.id).maybeSingle<VotingSession>(),
      supabase.from("read_ratings").select("user_id, score_halves, profiles(display_name)").eq("read_id", read.id),
      supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", clubId),
    ])

  const nominations = ((candidateRows ?? []) as unknown as Candidate[]).sort(
    // The winner first, then in the order they were nominated.
    (a, b) => Number(b.book_id === read.book_id) - Number(a.book_id === read.book_id),
  )
  const ratings = ((ratingRows ?? []) as unknown as RatingRow[]).sort(
    (a, b) =>
      b.score_halves - a.score_halves ||
      (a.profiles?.display_name ?? "").localeCompare(b.profiles?.display_name ?? ""),
  )
  const average = averageRating(ratings.map((rating) => rating.score_halves))
  const myRating = ratings.find((rating) => rating.user_id === user.id) ?? null

  // Results can name books that were withdrawn after the vote, so include the
  // ballot's own book list.
  const booksById = new Map<string, Book>(nominations.map((nomination) => [nomination.books.id, nomination.books]))
  if (sessionRow?.results) {
    const { data: sessionBookRows } = await supabase
      .from("voting_session_books")
      .select(`books(${BOOK_FIELDS})`)
      .eq("voting_session_id", sessionRow.id)
    for (const row of (sessionBookRows ?? []) as unknown as { books: Book | null }[]) {
      if (row.books) booksById.set(row.books.id, row.books)
    }
  }

  const book = read.books

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-5 pb-16 pt-10">
      <header>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/clubs/${club.id}`}>
              <ArrowLeftIcon data-icon="inline-start" />
              {club.name}
            </Link>
          }
        />
      </header>

      <section className="flex flex-col gap-5">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">
          Read #{read.number} · {statusLabel(read)}
        </p>
        {book ? (
          <div className="flex gap-4">
            <BookCover src={book.cover_image_url} title={book.title} className="w-24" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="font-serif text-3xl leading-tight text-pretty">{book.title}</h1>
                {book.authors.length ? (
                  <p className="text-sm text-muted-foreground">{book.authors.join(", ")}</p>
                ) : null}
              </div>
              <ReadDates
                startDate={read.start_date}
                discussionDate={read.discussion_date}
                showProgress={read.status === "current"}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-3xl leading-tight">Not picked yet</h1>
            <ReadDates startDate={read.start_date} discussionDate={read.discussion_date} />
          </div>
        )}
      </section>

      {read.status === "finished" ? (
        <section className="flex flex-col gap-5 border-t border-border pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SectionLabel>Ratings</SectionLabel>
            <p className="text-xs text-muted-foreground">
              {ratings.length} of {memberCount ?? ratings.length} members
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {myRating ? (
                <>
                  You gave it <span className="font-mono text-foreground">{formatRating(myRating.score_halves / 2)}</span>
                </>
              ) : (
                "You haven’t rated this one yet."
              )}
            </p>
            <RatingDialog
              clubId={club.id}
              readId={read.id}
              readNumber={read.number}
              title={book?.title ?? `read #${read.number}`}
              currentHalves={myRating?.score_halves ?? null}
              triggerLabel={myRating ? "Change rating" : "Rate it"}
              triggerVariant={myRating ? "outline" : "default"}
            />
          </div>

          {average !== null ? (
            <>
              <p className="flex items-baseline gap-2">
                <StarIcon className="size-5 self-center fill-primary text-primary" aria-hidden="true" />
                <span className="font-serif text-5xl leading-none">{formatRating(average)}</span>
                <span className="text-sm text-muted-foreground">club average out of 10</span>
              </p>
              <ul className="flex flex-col gap-3">
                {ratings.map((rating) => {
                  const score = rating.score_halves / 2
                  const name = rating.profiles?.display_name ?? "Member"
                  return (
                    <li key={rating.user_id} className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm">
                          {name}
                          {rating.user_id === user.id ? <span className="text-muted-foreground"> (you)</span> : null}
                        </span>
                        <span className="shrink-0 font-mono text-sm">{formatRating(score)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${score * 10}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody has rated this one yet.</p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <SectionLabel>
          Nominations <span className="font-sans tracking-normal text-muted-foreground">{nominations.length}</span>
        </SectionLabel>
        {nominations.length ? (
          <ul className="flex flex-col">
            {nominations.map((nomination) => {
              const won = nomination.book_id === read.book_id
              return (
                <li key={nomination.id} className="flex items-center gap-3 border-t border-border py-3">
                  <BookCover src={nomination.books.cover_image_url} title={nomination.books.title} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-pretty">
                      {won ? <TrophyIcon className="size-3.5 shrink-0 text-primary" aria-label="Winner" /> : null}
                      {nomination.books.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {nomination.books.authors.length ? nomination.books.authors.join(", ") : "Unknown author"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Nominated by {nomination.profiles?.display_name ?? "a member"}
                    </p>
                  </div>
                  <BookDetailsDialog book={nomination.books} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No nominations.</p>
        )}
      </section>

      {sessionRow?.results ? (
        <section className="flex flex-col gap-5 border-t border-border pt-8">
          <SectionLabel>The vote</SectionLabel>
          <VoteResults results={sessionRow.results} booksById={booksById} />
        </section>
      ) : null}
    </main>
  )
}
