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
  /** Normalized finished words, used for ranking. */
  completedWords: string[]
  /** The normalized word still being typed, matched as a prefix. */
  partial: string | null
}

/**
 * Google Books and Open Library match whole words, not prefixes. Mid-word,
 * "Operation bou" searches for the literal word "bou" and surfaces a book by
 * an author named Bou instead of "Operation Bounce House". So treat the last
 * word as unfinished unless the input ends in whitespace.
 */
export function parseQuery(raw: string): ParsedQuery {
  const full = raw.trim()
  const endsWithSpace = /\s$/.test(raw)
  const rawWords = full.split(/\s+/).filter(Boolean)

  if (endsWithSpace || rawWords.length < 2) {
    return {
      full,
      completed: null,
      completedWords: words(full),
      // A lone word may still be mid-typing; rank on it as a prefix too.
      partial: endsWithSpace ? null : (words(full).at(-1) ?? null),
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
  }
}

/** How many of the query's words a result's title or authors contain. */
function score(result: BookSearchResult, query: ParsedQuery): number {
  const haystack = words([result.title, ...result.authors].join(" "))
  let total = 0

  for (const word of query.completedWords) {
    // Prefix rather than exact, so "operation" still credits "Operations".
    if (haystack.some((candidate) => candidate.startsWith(word))) total += 1
  }

  if (query.partial && !query.completedWords.includes(query.partial)) {
    if (haystack.some((candidate) => candidate.startsWith(query.partial!))) total += 1
  }

  return total
}

/**
 * Merges result lists (earlier lists win on duplicates), then stably sorts
 * them so results matching more of the query come first. Results that match
 * nothing are kept, not dropped: an ISBN search matches no title words but
 * the provider's own ordering is still right.
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

  return merged
    .map((result, index) => ({ result, index, score: score(result, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ result }) => result)
}
