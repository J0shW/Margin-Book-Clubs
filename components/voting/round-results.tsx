import { Badge } from "@/components/ui/badge"
import { eliminationTiebreakText } from "@/lib/voting"
import type { Book, RunoffResults } from "@/lib/types"

type Props = {
  results: RunoffResults
  booksById: Map<string, Book>
}

export function RoundResults({ results, booksById }: Props) {
  const title = (bookId: string) => booksById.get(bookId)?.title ?? "Unknown book"

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {results.total_ballots} {results.total_ballots === 1 ? "ballot" : "ballots"} across {results.rounds.length}{" "}
        {results.rounds.length === 1 ? "round" : "rounds"}
      </p>

      {results.rounds.map((round) => {
        const max = Math.max(1, ...round.counts.map((c) => c.votes))
        const eliminated = round.eliminated ?? []
        const tiebreak = eliminationTiebreakText(round.tiebreak)
        return (
          <div key={round.round} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Round {round.round}</h4>
              {round.round === results.rounds.length ? <Badge variant="secondary">Final</Badge> : null}
            </div>
            <ul className="flex flex-col gap-2">
              {round.counts.map((count) => {
                const isWinner = count.book_id === results.winner_book_id
                const isOut = eliminated.includes(count.book_id)
                return (
                  <li key={count.book_id} className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 items-baseline justify-between gap-3">
                      <span className={isOut ? "min-w-0 truncate text-sm text-muted-foreground line-through" : "min-w-0 truncate text-sm"}>
                        {title(count.book_id)}
                      </span>
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
            {eliminated.length ? (
              <p className="text-xs text-muted-foreground">
                Eliminated: {eliminated.map(title).join(", ")}.{tiebreak ? ` ${tiebreak}` : ""}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
