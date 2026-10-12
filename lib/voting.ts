import type { VotingMethod } from "@/lib/types"

export const VOTING_METHODS: { value: VotingMethod; label: string; description: string }[] = [
  {
    value: "consensus",
    label: "Consensus",
    description:
      "Every ranking earns points, and books ranked near the bottom earn far fewer. Picks the book most people are happy with.",
  },
  {
    value: "runoff",
    label: "Ranked-choice runoff",
    description:
      "Last place is eliminated round by round and those ballots move to their next choice, until one book has a majority.",
  },
]

export function votingMethodLabel(method: VotingMethod): string {
  return VOTING_METHODS.find((m) => m.value === method)?.label ?? method
}

/**
 * Consensus points for a position on a ballot of n books: 1st is worth n,
 * last is worth 0, and the gaps grow toward the bottom. Mirrors
 * public.consensus_standings in the database, which does the real count.
 */
export function consensusPoints(rank: number, n: number): number {
  if (n <= 1) return 1
  const x = (rank - 1) / (n - 1)
  return n * (1 - x * x)
}

/** Ballot instructions, which differ by how the ballots will be counted. */
export function ballotInstructions(method: VotingMethod): string {
  return method === "runoff"
    ? "Put your first choice at the top. If it gets eliminated, your vote transfers to the next book on your list."
    : "Put your first choice at the top. Every position earns points, and books near the bottom earn much less, so the book the most people are happy with wins."
}

/** Why the winner won, for the results summary. */
export function decidedByText(decidedBy: string | null | undefined): string | null {
  switch (decidedBy) {
    case "fewest_last":
      return "Tied on points; won by being ranked last by the fewest people."
    case "most_first":
      return "Tied on points and last places; won by having the most first-place rankings."
    case "organizer":
      return "The count was a tie, so the organizer picked the winner."
    case "majority":
      return "Won with a majority of ballots."
    case "last_remaining":
      return "Won as the last book remaining."
    default:
      return null
  }
}

export function eliminationTiebreakText(tiebreak: string | null | undefined): string | null {
  switch (tiebreak) {
    case "most_last":
      return "Tie for last broken by who was ranked last most often."
    case "fewest_first":
      return "Tie for last broken by fewest first-place rankings."
    case "all_tied":
      return "Books tied for last on every measure were eliminated together."
    default:
      return null
  }
}

/** Small deterministic PRNG (mulberry32) so a member's ballot order is stable. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Shuffles a ballot's starting order per member and vote. Starting everyone in
 * nomination order would hand the first-listed books an edge from anyone who
 * submits without reordering; seeding keeps the order stable across reloads.
 */
export function shuffleForVoter<T>(items: T[], seed: string): T[] {
  const random = mulberry32(hashString(seed))
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
