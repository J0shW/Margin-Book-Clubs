import type { ManualBookInput } from "@/lib/types"

export const MAX_PAGE_COUNT = 20000

export type ManualBookFields = {
  title: string
  authors: string
  publishedYear: string
  pageCount: string
}

/**
 * Checks a hand-entered book. Shared by the form (for instant feedback) and
 * the server action (which can't trust the form), so both give the same
 * messages.
 */
export function validateManualBook(
  fields: ManualBookFields,
  currentYear = new Date().getFullYear(),
): { book: ManualBookInput; error?: undefined } | { error: string; book?: undefined } {
  const title = fields.title.trim()
  if (!title) return { error: "Give the book a title." }
  if (title.length > 300) return { error: "That title is too long." }

  const authors = fields.authors
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean)
  if (authors.length > 10) return { error: "List at most 10 authors." }
  if (authors.some((author) => author.length > 200)) return { error: "An author’s name is too long." }

  const year = fields.publishedYear.trim()
  if (year && (!/^\d{1,4}$/.test(year) || Number(year) < 1 || Number(year) > currentYear + 1)) {
    return { error: `Published year must be a year between 1 and ${currentYear + 1}.` }
  }

  const pages = fields.pageCount.trim()
  if (pages && (!/^\d+$/.test(pages) || Number(pages) < 1 || Number(pages) > MAX_PAGE_COUNT)) {
    return { error: "Page count must be a whole number of pages." }
  }

  return {
    book: {
      title,
      authors,
      publishedDate: year ? String(Number(year)) : null,
      pageCount: pages ? Number(pages) : null,
    },
  }
}
