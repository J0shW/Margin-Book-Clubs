import { describe, expect, it } from "vitest"
import { parseQuery, rankResults } from "@/lib/book-search"
import type { BookSearchResult } from "@/lib/types"

function book(
  sourceId: string,
  title: string,
  authors: string[] = ["Some Author"],
  coverImageUrl: string | null = "https://example.com/cover.jpg",
): BookSearchResult {
  return {
    sourceId,
    title,
    authors,
    description: null,
    categories: [],
    coverImageUrl,
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
      isbn: null,
    })
  })

  it("treats every word as finished once the input ends in a space", () => {
    expect(parseQuery("Operation bounce ")).toEqual({
      full: "Operation bounce",
      completed: null,
      completedWords: ["operation", "bounce"],
      partial: null,
      isbn: null,
    })
  })

  it("does not split a single word into a separate query", () => {
    expect(parseQuery("dinni")).toEqual({
      full: "dinni",
      completed: null,
      completedWords: ["dinni"],
      partial: "dinni",
      isbn: null,
    })
  })

  it("normalizes case, accents, and punctuation in the words it ranks on", () => {
    const parsed = parseQuery("Operação bounce-ho")
    expect(parsed.completed).toBe("Operação")
    expect(parsed.completedWords).toEqual(["operacao", "bounce"])
    expect(parsed.partial).toBe("ho")
  })

  it("recognizes ISBN-10 and ISBN-13 with or without hyphens", () => {
    expect(parseQuery("978-0-593-82024-7").isbn).toBe("9780593820247")
    expect(parseQuery("059382024x").isbn).toBe("059382024X")
    expect(parseQuery("12345").isbn).toBeNull()
  })

  it("ignores surrounding whitespace in the text it sends", () => {
    expect(parseQuery("   Operation   bou").full).toBe("Operation   bou")
  })
})

describe("rankResults", () => {
  it("keeps only results whose title or author matches every word", () => {
    // Roughly what the providers return for "Operation bou" and "Operation".
    const fullQuery = [
      book("ol:1", "Limits of Peacekeeping", ["Jean Bou", "David Horner"]),
      book("ol:2", "Sahara Occidental", ["Martine de Froberville"]),
    ]
    const completedQuery = [
      book("gb:a", "Historical Dictionary of the War in Vietnam", ["Ronald B. Frankum Jr."]),
      book("gb:b", "Operation Bounce House", ["Matt Dinniman"]),
      book("gb:c", "Operation Mincemeat", ["Ben Macintyre"]),
    ]

    const ranked = rankResults([fullQuery, completedQuery], parseQuery("Operation bou"), 12)

    expect(ranked.map((r) => r.title)).toEqual(["Operation Bounce House"])
  })

  it("matches across title and author together", () => {
    const ranked = rankResults(
      [[book("gb:a", "Some Other Book"), book("gb:b", "Dungeon Crawler Carl", ["Matt Dinniman"])]],
      parseQuery("crawler dinni"),
      12,
    )
    expect(ranked.map((r) => r.sourceId)).toEqual(["gb:b"])
  })

  it("does not match a word in the middle of another word", () => {
    const ranked = rankResults([[book("gb:a", "Rebound")]], parseQuery("bou"), 12)
    expect(ranked).toEqual([])
  })

  it("keeps the provider's order among equally good matches", () => {
    const ranked = rankResults(
      [[book("gb:a", "Bounce"), book("gb:b", "Bouncing Back"), book("gb:c", "Boundaries")]],
      parseQuery("bou"),
      12,
    )
    expect(ranked.map((r) => r.sourceId)).toEqual(["gb:a", "gb:b", "gb:c"])
  })

  it("pushes results with no author or cover below real books", () => {
    const ranked = rankResults(
      [
        [
          book("gb:a", "Operation Reports", [], null),
          book("gb:b", "Operation Manual", ["Some Author"], null),
          book("gb:c", "Operation Bounce House", ["Matt Dinniman"]),
        ],
      ],
      parseQuery("operation "),
      12,
    )
    expect(ranked.map((r) => r.sourceId)).toEqual(["gb:c", "gb:b", "gb:a"])
  })

  it("collapses editions of the same book, keeping the best one", () => {
    const ranked = rankResults(
      [
        [
          book("gb:a", "Operation Bounce House", ["Matt Dinniman"], null),
          book("gb:b", "Operation Bounce House: A Novel", ["Matt Dinniman"]),
          book("gb:c", "Operation Bounce House", ["Someone Else"]),
        ],
      ],
      parseQuery("operation bounce"),
      12,
    )
    expect(ranked.map((r) => r.sourceId)).toEqual(["gb:b", "gb:c"])
  })

  it("skips filtering for an ISBN search", () => {
    const ranked = rankResults([[book("gb:a", "Operation Bounce House")]], parseQuery("9780593820247"), 12)
    expect(ranked).toHaveLength(1)
  })

  it("drops duplicates, keeping the first list's copy", () => {
    const ranked = rankResults(
      [[book("gb:a", "Operation Bounce House")], [book("gb:a", "Duplicate"), book("gb:b", "Operation Other")]],
      parseQuery("operation "),
      12,
    )
    expect(ranked.map((r) => r.title)).toEqual(["Operation Bounce House", "Operation Other"])
  })

  it("skips providers that failed and respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => book(`gb:${i}`, `Book ${i}`))
    expect(rankResults([null, many], parseQuery("book"), 12)).toHaveLength(12)
  })
})
