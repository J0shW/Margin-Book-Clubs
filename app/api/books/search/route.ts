import { parseQuery, rankResults } from "@/lib/book-search"
import { searchGoogleBooks, searchOpenLibrary } from "@/lib/book-sources"
import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

/** How many results the dialog shows. */
const RESULT_LIMIT = 12

export async function GET(request: NextRequest) {
  // Only signed-in members may use the search proxy.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Not trimmed here: a trailing space tells parseQuery the last word is done.
  const query = parseQuery(request.nextUrl.searchParams.get("q") ?? "")
  if (query.full.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Search the text as typed, plus (mid-word) just the finished words, since
  // providers can't prefix-match the word still being typed. Both providers
  // also match on a book's contents, so rankResults then keeps only results
  // whose title or author matches.
  const queries = query.isbn
    ? [`isbn:${query.isbn}`]
    : query.completed
      ? [query.full, query.completed]
      : [query.full]

  // Google Books first, then Open Library when it is rate limited or down.
  const google = await Promise.all(queries.map(searchGoogleBooks))
  const googleResults = rankResults(google, query, RESULT_LIMIT)
  if (googleResults.length > 0) {
    return NextResponse.json({ results: googleResults })
  }

  const openLibrary = await Promise.all(queries.map(searchOpenLibrary))
  if (openLibrary.some((list) => list !== null)) {
    return NextResponse.json({ results: rankResults(openLibrary, query, RESULT_LIMIT) })
  }

  if (google.some((list) => list !== null)) {
    return NextResponse.json({ results: [] })
  }

  return NextResponse.json({ error: "search_failed" }, { status: 502 })
}
