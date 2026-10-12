import type { Book, ConsensusResults as ConsensusResultsData } from "@/lib/types"

type Props = {
  results: ConsensusResultsData
  booksById: Map<string, Book>
}

function formatPoints(points: number): string {
  return String(Math.round(points * 10) / 10)
}

export function ConsensusResults({ results, booksById }: Props) {
  const max = Math.max(1, ...results.standings.map((s) => s.points))
  const tied = new Set(results.tied_book_ids ?? [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {results.total_ballots} {results.total_ballots === 1 ? "ballot" : "ballots"} · up to{" "}
        {results.book_count} points per ballot for a 1st place, 0 for last
      </p>
      <ol className="flex flex-col gap-3">
        {results.standings.map((standing, index) => {
          const isWinner = standing.book_id === results.winner_book_id
          const isTied = tied.has(standing.book_id)
          return (
            <li key={standing.book_id} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm text-pretty">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  {booksById.get(standing.book_id)?.title ?? "Unknown book"}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatPoints(standing.points)} pts
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={isWinner || isTied ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-chart-3"}
                  style={{ width: `${(standing.points / max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                1st × {standing.firsts} · last × {standing.lasts}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
