import { cleanAuthors, cleanCategories, cleanDescription } from "@/lib/books"
import { createClient } from "@/lib/supabase/server"
import type { BookSearchResult } from "@/lib/types"
import { type NextRequest, NextResponse } from "next/server"

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
}

async function searchGoogleBooks(q: string): Promise<BookSearchResult[] | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes")
  url.searchParams.set("q", q)
  url.searchParams.set("maxResults", "12")
  url.searchParams.set("printType", "books")
  url.searchParams.set("orderBy", "relevance")
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

  try {
    // Next.js caches a fetch response for the full revalidate window even
    // when it's an error (a 429/503/etc looks identical to success here),
    // so this stays short — a bad response should self-heal in a minute,
    // not freeze that search as broken for the rest of the hour.
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null

    const data = (await res.json()) as { items?: GoogleVolume[] }

    return (data.items ?? [])
      .filter((item) => item.volumeInfo?.title)
      .map((item) => {
        const info = item.volumeInfo!
        const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
        return {
          sourceId: `gb:${item.id}`,
          title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title!,
          authors: cleanAuthors(info.authors),
          description: cleanDescription(info.description),
          categories: cleanCategories(info.categories),
          coverImageUrl: thumb ? thumb.replace(/^http:\/\//, "https://") : null,
          publishedDate: info.publishedDate ?? null,
          pageCount: info.pageCount ?? null,
        }
      })
  } catch {
    return null
  }
}

async function searchOpenLibrary(q: string): Promise<BookSearchResult[] | null> {
  const url = new URL("https://openlibrary.org/search.json")
  url.searchParams.set("q", q)
  url.searchParams.set("limit", "12")
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,first_sentence,subject",
  )

  try {
    // Next.js caches a fetch response for the full revalidate window even
    // when it's an error (a 429/503/etc looks identical to success here),
    // so this stays short — a bad response should self-heal in a minute,
    // not freeze that search as broken for the rest of the hour.
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null

    const data = (await res.json()) as { docs?: OpenLibraryDoc[] }

    return (data.docs ?? [])
      .filter((doc) => doc.title && doc.key)
      .map((doc) => ({
        sourceId: `ol:${doc.key}`,
        title: doc.title!,
        authors: cleanAuthors(doc.author_name),
        description: doc.first_sentence?.[0] ?? null,
        categories: cleanCategories(doc.subject),
        coverImageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
        publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
        pageCount: doc.number_of_pages_median ?? null,
      }))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // Only signed-in members may use the search proxy.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Google Books first, then Open Library when it is rate limited or down.
  const google = await searchGoogleBooks(q)
  if (google && google.length > 0) {
    return NextResponse.json({ results: google })
  }

  const openLibrary = await searchOpenLibrary(q)
  if (openLibrary) {
    return NextResponse.json({ results: openLibrary })
  }

  if (google) {
    return NextResponse.json({ results: google })
  }

  return NextResponse.json({ error: "search_failed" }, { status: 502 })
}
