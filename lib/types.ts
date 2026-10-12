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
  max_nominations_per_member: number
  voting_method: VotingMethod
  created_at: string
}

export type Candidate = {
  id: string
  club_id: string
  book_id: string
  added_by: string
  added_at: string
  books: Book
  profiles: { display_name: string | null } | null
}

export type ReadStatus = "nominating" | "voting" | "up_next" | "current" | "finished"

export type Read = {
  id: string
  club_id: string
  number: number
  status: ReadStatus
  book_id: string | null
  start_date: string | null
  discussion_date: string | null
  finished_at: string | null
  books: Book | null
}

export type VotingMethod = "consensus" | "runoff"

export type RoundCount = { book_id: string; votes: number }

/** Instant-runoff results. Votes closed before consensus existed have no `method`. */
export type RunoffResults = {
  method?: "runoff"
  total_ballots: number
  winner_book_id: string | null
  decided_by?: string | null
  tied_book_ids?: string[] | null
  rounds: {
    round: number
    active_ballots: number
    counts: RoundCount[]
    eliminated?: string[]
    tiebreak?: string | null
  }[]
}

export type ConsensusStanding = { book_id: string; points: number; firsts: number; lasts: number }

export type ConsensusResults = {
  method: "consensus"
  total_ballots: number
  book_count: number
  winner_book_id: string | null
  decided_by: string | null
  tied_book_ids: string[] | null
  standings: ConsensusStanding[]
}

export type TallyResults = RunoffResults | ConsensusResults

export type VotingSession = {
  id: string
  club_id: string
  status: "active" | "tied" | "completed"
  method: VotingMethod
  started_at: string
  ended_at: string | null
  winning_book_id: string | null
  results: TallyResults | null
}

export type ActionState = { error?: string; success?: string } | null
