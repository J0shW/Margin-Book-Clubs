export type Book = {
  id: string
  source_id: string
  title: string
  authors: string[]
  description: string | null
  categories: string[]
  cover_image_url: string | null
  published_date: string | null
  page_count: number | null
}

export type BookSearchResult = {
  sourceId: string
  title: string
  authors: string[]
  description: string | null
  categories: string[]
  coverImageUrl: string | null
  publishedDate: string | null
  pageCount: number | null
}

export type ManualBookInput = {
  title: string
  authors: string[]
  publishedDate: string | null
  pageCount: number | null
}

export type Club = {
  id: string
  name: string
  owner_id: string
  join_code: string
  current_book_id: string | null
  created_at: string
}

export type Candidate = {
  id: string
  club_id: string
  book_id: string
  added_by: string
  added_at: string
  books: Book
}

export type RoundCount = { book_id: string; votes: number }

export type TallyResults = {
  total_ballots: number
  winner_book_id: string
  rounds: { round: number; active_ballots: number; counts: RoundCount[] }[]
}

export type VotingSession = {
  id: string
  club_id: string
  status: "active" | "completed"
  started_at: string
  ended_at: string | null
  winning_book_id: string | null
  results: TallyResults | null
}

export type ActionState = { error?: string; success?: string } | null
