import { cleanAuthors, cleanCategories, cleanDescription } from "@/lib/books"
import type { BookSearchResult } from "@/lib/types"

/** How many results to ask each provider for when searching. */
const FETCH_LIMIT = 40

const GOOGLE_ID = /^[A-Za-z0-9_-]{1,40}$/
const OPEN_LIBRARY_WORK = /^\/works\/OL[0-9]{1,12}W$/

/** Hosts book covers may come from. The books table enforces the same list. */
const COVER_URL = /^https:\/\/(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)\//

type GoogleVolume = {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    description?: string
    categories?: string[]
    publishedDate?: string
    pageCount?: number
    language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

type OpenLibraryDoc = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  number_of_pages_median?: number
  first_sentence?: string[]
  subject?: string[]
  language?: string[]
}

const OPEN_LIBRARY_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,first_sentence,subject,language"

export function coverUrlOrNull(url: string | null | undefined): string | null {
  if (!url) return null
  const https = url.replace(/^http:\/\//, "https://")
  return COVER_URL.test(https) ? https : null
}

function pageCountOrNull(value: number | undefined): number | null {
  return Number.isInteger(value) && value! > 0 && value! <= 20000 ? value! : null
}

/** A year, year-month, or full date; anything else from a provider is dropped. */
function publishedDateOrNull(value: string | undefined): string | null {
  return value && /^\d{1,4}(-\d{2}(-\d{2})?)?$/.test(value) ? value : null
}

function googleUrl(path: string): URL {
  const url = new URL(`https://www.googleapis.com/books/v1/${path}`)
  // Serverless hosts (Vercel included) call out from IPs Google can't
  // geolocate, which the Books API rejects with "Cannot determine user
  // location for geographically restricted operation" unless a country
  // is given explicitly.
  url.searchParams.set("country", "US")
  // Unauthenticated requests share a small public quota that 429s under
  // normal traffic; a key moves the app onto its own per-project quota.
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY)
  }
  return url
}

function fromGoogleVolume(item: GoogleVolume): BookSearchResult | null {
  const info = item.volumeInfo
  if (!info?.title || !GOOGLE_ID.test(item.id)) return null
  return {
    sourceId: `gb:${item.id}`,
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    authors: cleanAuthors(info.authors),
    description: cleanDescription(info.description),
    categories: cleanCategories(info.categories),
    coverImageUrl: coverUrlOrNull(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    publishedDate: publishedDateOrNull(info.publishedDate),
    pageCount: pageCountOrNull(info.pageCount),
  }
}

function fromOpenLibraryDoc(doc: OpenLibraryDoc): BookSearchResult | null {
  if (!doc.title || !doc.key || !OPEN_LIBRARY_WORK.test(doc.key)) return null
  return {
    sourceId: `ol:${doc.key}`,
    title: doc.title,
    authors: cleanAuthors(doc.author_name),
    description: doc.first_sentence?.[0] ?? null,
    categories: cleanCategories(doc.subject),
    coverImageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: pageCountOrNull(doc.number_of_pages_median),
  }
}

export async function searchGoogleBooks(q: string): Promise<BookSearchResult[] | null> {
  const url = googleUrl("volumes")
  url.searchParams.set("q", q)
  url.searchParams.set("maxResults", String(FETCH_LIMIT))
  url.searchParams.set("printType", "books")
  url.searchParams.set("orderBy", "relevance")
  // Clubs read in English; without this, translations crowd out the original.
  url.searchParams.set("langRestrict", "en")

  try {
    // Next.js caches a fetch response for the full revalidate window even
    // when it's an error (a 429/503/etc looks identical to success here),
    // so this stays short — a bad response should self-heal in a minute,
    // not freeze that search as broken for the rest of the hour.
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null

    const data = (await res.json()) as { items?: GoogleVolume[] }

    return (
      (data.items ?? [])
        // langRestrict is a ranking hint more than a filter, so check too.
        .filter((item) => (item.volumeInfo?.language ?? "en") === "en")
        .map(fromGoogleVolume)
        .filter((book): book is BookSearchResult => book !== null)
    )
  } catch {
    return null
  }
}

async function openLibrarySearch(q: string, limit: number): Promise<OpenLibraryDoc[] | null> {
  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("fields", OPEN_LIBRARY_FIELDS)

  try {
    // Short revalidate for the same reason as Google above.
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = (await res.json()) as { docs?: OpenLibraryDoc[] }
    return data.docs ?? []
  } catch {
    return null
  }
}

export async function searchOpenLibrary(q: string): Promise<BookSearchResult[] | null> {
  const docs = await openLibrarySearch(q, FETCH_LIMIT)
  if (!docs) return null
  return (
    docs
      // A work lists every language it has editions in; keep those with an
      // English edition, plus works with no language data at all.
      .filter((doc) => !doc.language?.length || doc.language.includes("eng"))
      .map(fromOpenLibraryDoc)
      .filter((book): book is BookSearchResult => book !== null)
  )
}

async function lookupGoogleVolume(id: string): Promise<BookSearchResult | null> {
  if (!GOOGLE_ID.test(id)) return null
  try {
    // Not cached: a cached 429 would block nominating this book for the window.
    const res = await fetch(googleUrl(`volumes/${id}`), { cache: "no-store" })
    if (!res.ok) return null
    return fromGoogleVolume((await res.json()) as GoogleVolume)
  } catch {
    return null
  }
}

type OpenLibraryWorkRecord = {
  key?: string
  title?: string
  covers?: number[]
  authors?: { author?: { key?: string } }[]
  first_publish_date?: string
  subjects?: string[]
}

async function fetchOpenLibraryJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://openlibrary.org${path}.json`, { next: { revalidate: 86400 } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

async function lookupOpenLibraryWork(key: string): Promise<BookSearchResult | null> {
  if (!OPEN_LIBRARY_WORK.test(key)) return null

  // The search index has the same fields the search results showed,
  // including a page count. Quoted, since a bare "/" starts a regex there.
  const docs = await openLibrarySearch(`key:"${key}"`, 1)
  const doc = docs?.find((candidate) => candidate.key === key)
  if (doc) return fromOpenLibraryDoc(doc)

  // Fall back to the work record, which names authors only by key.
  const work = await fetchOpenLibraryJson<OpenLibraryWorkRecord>(key)
  if (!work?.title || work.key !== key) return null
  const authorKeys = (work.authors ?? [])
    .map((entry) => entry.author?.key)
    .filter((authorKey): authorKey is string => !!authorKey && /^\/authors\/OL[0-9]{1,12}A$/.test(authorKey))
    .slice(0, 3)
  const authors = await Promise.all(
    authorKeys.map((authorKey) => fetchOpenLibraryJson<{ name?: string }>(authorKey)),
  )
  const cover = work.covers?.find((id) => Number.isInteger(id) && id > 0)
  return {
    sourceId: `ol:${key}`,
    title: work.title,
    authors: cleanAuthors(authors.map((author) => author?.name ?? "").filter(Boolean)),
    description: null,
    categories: cleanCategories(work.subjects),
    coverImageUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null,
    publishedDate: work.first_publish_date?.match(/\d{4}/)?.[0] ?? null,
    pageCount: null,
  }
}

/**
 * Fetches a book's details from its provider by source id ("gb:<volume id>"
 * or "ol:/works/<id>"). Nominations use this rather than details sent by the
 * browser, since the shared catalog row is what every club sees. Returns null
 * for an unknown id or when the provider can't be reached.
 */
export async function lookupBook(sourceId: string): Promise<BookSearchResult | null> {
  if (sourceId.startsWith("gb:")) return lookupGoogleVolume(sourceId.slice(3))
  if (sourceId.startsWith("ol:")) return lookupOpenLibraryWork(sourceId.slice(3))
  return null
}
