import type { BookSearchResult } from "@/lib/types"

/**
 * Lowercases, strips accents, and splits on anything that isn't a letter or
 * digit, so "Bounce-House" and "bounce house" tokenize the same way.
 */
function words(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export type ParsedQuery = {
  /** The text exactly as typed (trimmed), sent to the provider as-is. */
  full: string
  /**
   * Only the words the user has finished typing, or null when there's no
   * separate query to run (a single word, or input that ends in a space).
   */
  completed: string | null
  /** Normalized finished words, each matched as a prefix of a title/author word. */
  completedWords: string[]
  /** The normalized word still being typed, matched as a prefix. */
  partial: string | null
  /** Set when the whole query is an ISBN-10 or ISBN-13. */
  isbn: string | null
}

/** Recognizes ISBN-10 and ISBN-13, with or without hyphens and spaces. */
function parseIsbn(value: string): string | null {
  const compact = value.replace(/[-\s]/g, "").toUpperCase()
  return /^(\d{9}[\dX]|97[89]\d{10})$/.test(compact) ? compact : null
}

/**
 * Google Books and Open Library match whole words, not prefixes. Mid-word,
 * "Operation bou" searches for the literal word "bou" and surfaces a book by
 * an author named Bou instead of "Operation Bounce House". So treat the last
 * word as unfinished unless the input ends in whitespace.
 */
export function parseQuery(raw: string): ParsedQuery {
  const full = raw.trim()
  const isbn = parseIsbn(full)
  const endsWithSpace = /\s$/.test(raw)
  const rawWords = full.split(/\s+/).filter(Boolean)

  if (isbn || endsWithSpace || rawWords.length < 2) {
    return {
      full,
      completed: null,
      completedWords: words(full),
      // A lone word may still be mid-typing; match it as a prefix too.
      partial: isbn || endsWithSpace ? null : (words(full).at(-1) ?? null),
      isbn,
    }
  }

  const completed = rawWords.slice(0, -1).join(" ")
  const completedWords = words(completed)
  const partialWords = words(rawWords[rawWords.length - 1])

  return {
    full,
    completed,
    // Punctuation inside the last raw word ("bounce-ho") can split it; every
    // piece but the final one is already finished.
    completedWords: [...completedWords, ...partialWords.slice(0, -1)],
    partial: partialWords.at(-1) ?? null,
    isbn: null,
  }
}

/**
 * True when every word of the query starts a word of the result's title or
 * authors. Providers also match on a book's full text and subjects, which is
 * how a war dictionary turns up for "Operation boun"; this keeps only books
 * whose title or author is actually what was typed.
 */
function matchesTitleOrAuthor(result: BookSearchResult, query: ParsedQuery): boolean {
  const haystack = words([result.title, ...result.authors].join(" "))
  const needles = query.partial ? [...query.completedWords, query.partial] : query.completedWords
  return needles.every((needle) => haystack.some((candidate) => candidate.startsWith(needle)))
}

/**
 * Results without an author or cover are nearly always government reports,
 * court records, and other scanned reference material, not club picks.
 */
function quality(result: BookSearchResult): number {
  return (result.authors.length > 0 ? 1 : 0) + (result.coverImageUrl ? 1 : 0)
}

/** Hardcover, paperback, ebook and reprints share a main title and author. */
function editionKey(result: BookSearchResult): string {
  const mainTitle = result.title.split(":")[0]
  return `${words(mainTitle).join(" ")}|${words(result.authors[0] ?? "").join(" ")}`
}

/**
 * Merges result lists (earlier lists win on duplicates), keeps only results
 * whose title or author matches the query, orders likely-real books first
 * (otherwise keeping the providers' relevance order), and collapses editions
 * of the same book into one row.
 */
export function rankResults(
  lists: (BookSearchResult[] | null)[],
  query: ParsedQuery,
  limit: number,
): BookSearchResult[] {
  const seen = new Set<string>()
  const merged: BookSearchResult[] = []

  for (const list of lists) {
    for (const result of list ?? []) {
      if (seen.has(result.sourceId)) continue
      seen.add(result.sourceId)
      merged.push(result)
    }
  }

  // An ISBN identifies one edition exactly; there's nothing to filter.
  if (query.isbn) return merged.slice(0, limit)

  const ordered = merged
    .filter((result) => matchesTitleOrAuthor(result, query))
    .map((result, index) => ({ result, index, quality: quality(result) }))
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ result }) => result)

  const editions = new Set<string>()
  const unique: BookSearchResult[] = []
  for (const result of ordered) {
    const key = editionKey(result)
    if (editions.has(key)) continue
    editions.add(key)
    unique.push(result)
    if (unique.length >= limit) break
  }

  return unique
}
