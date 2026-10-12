import { describe, expect, it } from "vitest"
import { consensusPoints, shuffleForVoter } from "@/lib/voting"

describe("consensusPoints", () => {
  it("gives 1st n points and last 0, with gaps growing toward the bottom", () => {
    const points = [1, 2, 3, 4, 5].map((rank) => consensusPoints(rank, 5))
    expect(points).toEqual([5, 4.6875, 3.75, 2.1875, 0])
    const gaps = points.slice(1).map((p, i) => points[i] - p)
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b))
  })

  it("prefers a book everyone ranks 3rd over one loved by 3 and ranked last by 2", () => {
    const polarizing = 3 * consensusPoints(1, 5) + 2 * consensusPoints(5, 5)
    const consensus = 5 * consensusPoints(3, 5)
    expect(consensus).toBeGreaterThan(polarizing)
  })

  it("handles one- and two-book ballots", () => {
    expect(consensusPoints(1, 1)).toBe(1)
    expect([consensusPoints(1, 2), consensusPoints(2, 2)]).toEqual([2, 0])
  })
})

describe("shuffleForVoter", () => {
  const books = ["a", "b", "c", "d", "e", "f"]

  it("is stable for the same voter and vote", () => {
    expect(shuffleForVoter(books, "user-1:vote-1")).toEqual(shuffleForVoter(books, "user-1:vote-1"))
  })

  it("keeps every book exactly once", () => {
    expect([...shuffleForVoter(books, "user-1:vote-1")].sort()).toEqual(books)
  })

  it("varies between voters, so no book is always listed first", () => {
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => shuffleForVoter(books, `user-${i}:vote-1`)[0]))
    expect(firsts.size).toBeGreaterThan(3)
  })

  it("does not modify the input", () => {
    const copy = [...books]
    shuffleForVoter(books, "x")
    expect(books).toEqual(copy)
  })
})
