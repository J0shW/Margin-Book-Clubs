import { describe, expect, it } from "vitest"
import { parseQuery, rankResults } from "@/lib/book-search"
import type { BookSearchResult } from "@/lib/types"

function book(sourceId: string, title: string, authors: string[] = []): BookSearchResult {
  return {
    sourceId,
    title,
    authors,
    description: null,
    categories: [],
    coverImageUrl: null,
    publishedDate: null,
    pageCount: null,
  }
}

describe("parseQuery", () => {
  it("splits off the word still being typed", () => {
    expect(parseQuery("Operation bou")).toEqual({
      full: "Operation bou",
      completed: "Operation",
      completedWords: ["operation"],
      partial: "bou",
    })
  })

  it("treats every word as finished once the input ends in a space", () => {
    expect(parseQuery("Operation bounce ")).toEqual({
      full: "Operation bounce",
      completed: null,
      completedWords: ["operation", "bounce"],
      partial: null,
    })
  })

  it("does not split a single word into a separate query", () => {
    expect(parseQuery("dinni")).toEqual({
      full: "dinni",
      completed: null,
      completedWords: ["dinni"],
      partial: "dinni",
    })
  })

  it("normalizes case, accents, and punctuation in the words it ranks on", () => {
    const parsed = parseQuery("Operação bounce-ho")
    expect(parsed.completed).toBe("Operação")
    expect(parsed.completedWords).toEqual(["operacao", "bounce"])
    expect(parsed.partial).toBe("ho")
  })

  it("ignores surrounding whitespace in the text it sends", () => {
    expect(parseQuery("   Operation   bou").full).toBe("Operation   bou")
  })
})

describe("rankResults", () => {
  it("promotes the result whose words start with the partial word", () => {
    // Roughly what the providers return for "Operation bou" and "Operation".
    const fullQuery = [
      book("ol:1", "Limits of Peacekeeping", ["Jean Bou", "David Horner"]),
      book("ol:2", "Sahara Occidental", ["Martine de Froberville"]),
    ]
    const completedQuery = [
      book("gb:a", "Historical Dictionary of the War in Vietnam"),
      book("gb:b", "Operation Bounce House", ["Matt Dinniman"]),
      book("gb:c", "Operation Mincemeat", ["Ben Macintyre"]),
    ]

    const ranked = rankResults([fullQuery, completedQuery], parseQuery("Operation bou"), 12)

    expect(ranked[0].title).toBe("Operation Bounce House")
  })

  it("matches the partial word against authors too", () => {
    const ranked = rankResults(
      [[book("gb:a", "Some Other Book"), book("gb:b", "Dungeon Crawler Carl", ["Matt Dinniman"])]],
      parseQuery("dinni"),
      12,
    )
    expect(ranked[0].sourceId).toBe("gb:b")
  })

  it("keeps the provider's order among equally good matches", () => {
    const ranked = rankResults(
      [[book("gb:a", "Bounce"), book("gb:b", "Bouncing Back"), book("gb:c", "Boundaries")]],
      parseQuery("bou"),
      12,
    )
    expect(ranked.map((r) => r.sourceId)).toEqual(["gb:a", "gb:b", "gb:c"])
  })

  it("keeps results that match no words, such as an ISBN search", () => {
    const ranked = rankResults([[book("gb:a", "Operation Bounce House")]], parseQuery("9780593820247"), 12)
    expect(ranked).toHaveLength(1)
  })

  it("drops duplicates, keeping the first list's copy", () => {
    const ranked = rankResults(
      [[book("gb:a", "Operation Bounce House")], [book("gb:a", "Duplicate"), book("gb:b", "Other")]],
      parseQuery("operation bou"),
      12,
    )
    expect(ranked.map((r) => r.title)).toEqual(["Operation Bounce House", "Other"])
  })

  it("skips providers that failed and respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => book(`gb:${i}`, `Book ${i}`))
    expect(rankResults([null, many], parseQuery("book"), 12)).toHaveLength(12)
  })
})
