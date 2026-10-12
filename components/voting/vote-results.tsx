import { ConsensusResults } from "@/components/voting/consensus-results"
import { RoundResults } from "@/components/voting/round-results"
import { decidedByText, votingMethodLabel } from "@/lib/voting"
import type { Book, TallyResults } from "@/lib/types"

type Props = {
  results: TallyResults
  booksById: Map<string, Book>
}

/** Results for either voting method, with a note on how the winner was decided. */
export function VoteResults({ results, booksById }: Props) {
  const method = results.method === "consensus" ? "consensus" : "runoff"
  const decided = decidedByText(results.decided_by)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{votingMethodLabel(method)}</p>
      {results.method === "consensus" ? (
        <ConsensusResults results={results} booksById={booksById} />
      ) : (
        <RoundResults results={results} booksById={booksById} />
      )}
      {decided ? <p className="text-sm text-muted-foreground">{decided}</p> : null}
    </div>
  )
}
