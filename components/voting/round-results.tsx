import { BookCover } from "@/components/books/book-cover"
import { Badge } from "@/components/ui/badge"
import type { Book, TallyResults } from "@/lib/types"

type Props = {
  results: TallyResults
  booksById: Map<string, Book>
  winner: Book | undefined
}

export function RoundResults({ results, booksById, winner }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {winner ? (
        <div className="flex items-start gap-4 rounded-lg border border-primary/40 bg-accent p-4">
          <BookCover src={winner.cover_image_url} title={winner.title} className="w-16" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">The next read</p>
            <p className="font-serif text-2xl leading-tight text-pretty">{winner.title}</p>
            <p className="text-sm text-muted-foreground">
              {winner.authors.length ? winner.authors.join(", ") : "Unknown author"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {results.total_ballots} {results.total_ballots === 1 ? "ballot" : "ballots"} across{" "}
          {results.rounds.length} {results.rounds.length === 1 ? "round" : "rounds"}
        </p>

        {results.rounds.map((round) => {
          const max = Math.max(1, ...round.counts.map((c) => c.votes))
          return (
            <div key={round.round} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Round {round.round}
                </h4>
                {round.round === results.rounds.length ? <Badge variant="secondary">Final</Badge> : null}
              </div>
              <ul className="flex flex-col gap-2">
                {round.counts.map((count) => {
                  const book = booksById.get(count.book_id)
                  const isWinner = count.book_id === results.winner_book_id
                  return (
                    <li key={count.book_id} className="flex min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm">{book?.title ?? "Unknown book"}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{count.votes}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={isWinner ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-chart-3"}
                          style={{ width: `${(count.votes / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
