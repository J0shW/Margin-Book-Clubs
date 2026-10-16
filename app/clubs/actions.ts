"use server"

import { lookupBook } from "@/lib/book-sources"
import { cleanCategories, fetchOpenLibraryWork } from "@/lib/books"
import { type ManualBookFields, validateManualBook } from "@/lib/manual-book"
import { MAX_NOMINATION_LIMIT } from "@/lib/clubs"
import { createClient } from "@/lib/supabase/server"
import type { ActionState, BookSearchResult, TallyResults, VotingMethod } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const RPC_MESSAGES: Record<string, string> = {
  invalid_join_code: "No club matches that code.",
  too_many_attempts: "Too many wrong codes. Wait a few minutes and try again.",
  removed_from_club: "The organizer removed you from this club.",
  cannot_remove_owner: "The organizer can’t be removed.",
  already_owner: "You’re already the organizer.",
  not_removed: "They aren’t blocked from this club.",
  book_not_editable: "Only the person who added this book, or the organizer, can edit it.",
  not_club_owner: "Only the club organizer can do that.",
  not_club_member: "You are not a member of this club.",
  session_already_active: "A vote is already running for this club.",
  need_two_candidates: "Add at least two books before starting a vote.",
  session_not_active: "This vote has already closed.",
  session_not_found: "That vote no longer exists.",
  no_ballots: "Nobody has voted yet.",
  invalid_book_in_ballot: "Your ballot references a book that isn’t in this vote.",
  duplicate_book_in_ballot: "Each book can only be ranked once.",
  empty_ballot: "Rank at least one book.",
  nominations_closed: "Nominations for this read are closed.",
  nomination_limit_reached: "You’ve nominated as many books as this club allows for one read.",
  read_not_current: "Only the current read can be marked finished.",
  read_not_found: "That read no longer exists.",
  session_not_tied: "That vote isn’t waiting on a tiebreak.",
  book_not_tied: "Pick one of the tied books.",
  next_read_already_open: "The next read is already open.",
  discussion_before_start: "The discussion date can’t be before the start date.",
  cannot_reopen: "Only the most recently finished read can be reopened, and only while nothing else is being read.",
}

function friendly(message: string | undefined, fallback: string) {
  if (!message) return fallback
  for (const key of Object.keys(RPC_MESSAGES)) {
    if (message.includes(key)) return RPC_MESSAGES[key]
  }
  return fallback
}

export async function createClubAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim()
  if (name.length < 2) return { error: "Give your club a name." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_club", { p_name: name }).single<{ id: string }>()

  if (error) {
    console.error("create_club failed:", error.message)
    return { error: friendly(error.message, "Could not create the club. Try again.") }
  }

  revalidatePath("/clubs")
  redirect(`/clubs/${data.id}`)
}

export async function joinClubAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
  if (code.length !== 6) return { error: "Join codes are six characters." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("join_club", { p_code: code })

  if (error) {
    console.error("join_club failed:", error.message)
    return { error: friendly(error.message, "Could not join that club. Try again.") }
  }
  // An unknown code returns null rather than raising, so the attempt is
  // recorded for rate limiting.
  if (!data) return { error: RPC_MESSAGES.invalid_join_code }

  revalidatePath("/clubs")
  redirect(`/clubs/${data as string}`)
}

type Supabase = Awaited<ReturnType<typeof createClient>>

async function findBook(supabase: Supabase, sourceId: string): Promise<string | null> {
  const { data } = await supabase.from("books").select("id").eq("source_id", sourceId).maybeSingle()
  return data?.id ?? null
}

/**
 * Adds a book to the shared catalog and returns its id. A unique violation
 * means another request inserted the same book first, so that row is used.
 * Returns null if the row could neither be created nor found.
 */
async function insertBook(supabase: Supabase, book: BookSearchResult): Promise<string | null> {
  // Open Library's search endpoint returns just a first sentence (often a
  // fragment in another language), so the work record supplies the real
  // synopsis.
  let description = book.description
  let categories = book.categories ?? []
  if (book.sourceId.startsWith("ol:")) {
    const work = await fetchOpenLibraryWork(book.sourceId.slice(3))
    if (work.description) description = work.description
    const workCategories = cleanCategories(work.subjects)
    if (workCategories.length) categories = workCategories
  }

  const inserted = await supabase
    .from("books")
    .insert({
      source_id: book.sourceId,
      title: book.title.slice(0, 300),
      authors: book.authors.slice(0, 10),
      description: description?.slice(0, 4000) ?? null,
      categories: categories.slice(0, 3),
      cover_image_url: book.coverImageUrl,
      published_date: book.publishedDate,
      page_count: book.pageCount,
    })
    .select("id")
    .single()

  if (inserted.data) return inserted.data.id
  if (inserted.error?.code === "23505") return findBook(supabase, book.sourceId)

  console.error("book insert failed:", inserted.error?.message)
  return null
}

async function nominate(supabase: Supabase, clubId: string, bookId: string, userId: string): Promise<string | null> {
  const { error } = await supabase.from("club_candidate_books").insert({
    club_id: clubId,
    book_id: bookId,
    added_by: userId,
  })
  if (!error) return null
  if (error.code === "23505") return "That book is already nominated."
  console.error("nominate failed:", error.message)
  return friendly(error.message, "Could not nominate that book.")
}

/**
 * Nominates a search result by its provider id. The book's details are
 * looked up on the server rather than taken from the browser, because the
 * catalog row is shared with every club that nominates the same book.
 */
export async function nominateBookAction(clubId: string, sourceId: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to nominate a book." }

  // Already in the catalog: reuse it rather than rewriting it. RLS blocks
  // updates by design, since one club must not edit what every club reads.
  let bookId = await findBook(supabase, sourceId)
  let title: string | null = null
  if (!bookId) {
    const book = await lookupBook(sourceId)
    if (!book) return { error: "Couldn’t load that book’s details. Try again in a moment." }
    title = book.title
    bookId = await insertBook(supabase, book)
    if (!bookId) return { error: "Could not save that book. Try again." }
  }

  const error = await nominate(supabase, clubId, bookId, user.id)
  if (error) return { error }

  revalidatePath(`/clubs/${clubId}`)
  return { success: title ? `“${title}” nominated.` : "Book nominated." }
}

export async function addManualBookAction(clubId: string, fields: ManualBookFields): Promise<ActionState> {
  const validated = validateManualBook(fields)
  if (!validated.book) return { error: validated.error }
  const input = validated.book

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to add a book." }

  // Books added by hand have no external catalog entry to key off of, so a
  // random id stands in for source_id.
  const bookId = await insertBook(supabase, {
    sourceId: `manual:${crypto.randomUUID()}`,
    title: input.title,
    authors: input.authors,
    description: null,
    categories: [],
    coverImageUrl: null,
    publishedDate: input.publishedDate,
    pageCount: input.pageCount,
  })
  if (!bookId) return { error: "Could not save that book. Try again." }

  const error = await nominate(supabase, clubId, bookId, user.id)
  if (error) return { error }

  revalidatePath(`/clubs/${clubId}`)
  return { success: `“${input.title}” added.` }
}

export async function removeCandidateAction(clubId: string, candidateId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from("club_candidate_books").delete().eq("id", candidateId)

  if (error) {
    console.error("remove candidate failed:", error.message)
    return { error: "Could not remove that nomination." }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Nomination removed." }
}

export async function startVotingAction(clubId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("start_voting_session", { p_club_id: clubId })

  if (error) {
    console.error("start_voting_session failed:", error.message)
    return { error: friendly(error.message, "Could not start the vote.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Voting is open." }
}

export async function closeVotingAction(clubId: string, sessionId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("close_voting_session", { p_session_id: sessionId })

  if (error) {
    console.error("close_voting_session failed:", error.message)
    return { error: friendly(error.message, "Could not close the vote.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  const results = data as TallyResults | null
  if (results && !results.winner_book_id) return { success: "It’s a tie. Pick the winner from the tied books." }
  return { success: "Results are in." }
}

export async function resolveVoteTieAction(clubId: string, sessionId: string, bookId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("resolve_vote_tie", { p_session_id: sessionId, p_book_id: bookId })

  if (error) {
    console.error("resolve_vote_tie failed:", error.message)
    return { error: friendly(error.message, "Could not pick the winner.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath("/clubs")
  return { success: "Winner picked." }
}

export async function updateVotingMethodAction(clubId: string, method: VotingMethod): Promise<ActionState> {
  if (method !== "consensus" && method !== "runoff") return { error: "Pick a voting method." }

  const supabase = await createClient()
  // RLS only lets the organizer update the club, so check a row actually changed.
  const { data, error } = await supabase
    .from("clubs")
    .update({ voting_method: method })
    .eq("id", clubId)
    .select("id")

  if (error || !data?.length) {
    if (error) console.error("update voting method failed:", error.message)
    return { error: "Only the club organizer can change the voting method." }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Voting method saved. It applies from the next vote." }
}

export async function finishReadAction(clubId: string, readId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("finish_read", { p_read_id: readId })

  if (error) {
    console.error("finish_read failed:", error.message)
    return { error: friendly(error.message, "Could not mark the read finished.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath("/clubs")
  return { success: "Read marked finished." }
}

/** Accepts "" (an empty date input) as no date. */
function readDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function startNextReadAction(
  clubId: string,
  startDate: string | null,
  discussionDate: string | null,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("start_next_read", {
    p_club_id: clubId,
    p_start_date: readDate(startDate),
    p_discussion_date: readDate(discussionDate),
  })

  if (error) {
    console.error("start_next_read failed:", error.message)
    return { error: friendly(error.message, "Could not start the next read.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Next read is open for nominations." }
}

export async function updateReadDatesAction(
  clubId: string,
  readId: string,
  startDate: string | null,
  discussionDate: string | null,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("update_read_dates", {
    p_read_id: readId,
    p_start_date: readDate(startDate),
    p_discussion_date: readDate(discussionDate),
  })

  if (error) {
    console.error("update_read_dates failed:", error.message)
    return { error: friendly(error.message, "Could not save those dates.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Dates saved." }
}

export async function reopenReadAction(clubId: string, readId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("reopen_read", { p_read_id: readId })

  if (error) {
    console.error("reopen_read failed:", error.message)
    return { error: friendly(error.message, "Could not reopen that read.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath("/clubs")
  return { success: "Read reopened." }
}

/**
 * Nominates books already in the catalog, e.g. ones that didn't win last time.
 * Each is inserted separately so one duplicate doesn't block the rest; stops
 * at the first other error (nominations closed, or the per-member cap).
 */
export async function renominateBooksAction(clubId: string, bookIds: string[]): Promise<ActionState> {
  if (!Array.isArray(bookIds) || bookIds.length === 0) return { error: "Pick at least one book." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to nominate a book." }

  let added = 0
  for (const bookId of bookIds) {
    const { error } = await supabase
      .from("club_candidate_books")
      .insert({ club_id: clubId, book_id: bookId, added_by: user.id })

    if (!error) {
      added += 1
      continue
    }
    if (error.code === "23505") continue

    console.error("renominate failed:", error.message)
    revalidatePath(`/clubs/${clubId}`)
    const reason = friendly(error.message, "Could not nominate that book.")
    return { error: added > 0 ? `Added ${added}. ${reason}` : reason }
  }

  revalidatePath(`/clubs/${clubId}`)
  if (added === 0) return { error: "Those books are already nominated." }
  return { success: added === 1 ? "Book nominated." : `${added} books nominated.` }
}

/**
 * Saves (or changes) the signed-in member's rating of a finished read. Scores
 * run 0.5–10 in half points and are stored as a count of halves (1–20).
 */
export async function rateReadAction(
  clubId: string,
  readId: string,
  readNumber: number,
  scoreHalves: number,
): Promise<ActionState> {
  if (!Number.isInteger(scoreHalves) || scoreHalves < 1 || scoreHalves > 20) {
    return { error: "Pick a score from 0.5 to 10." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to rate a book." }

  const { error } = await supabase
    .from("read_ratings")
    .upsert(
      { read_id: readId, user_id: user.id, score_halves: scoreHalves, updated_at: new Date().toISOString() },
      { onConflict: "read_id,user_id" },
    )

  if (error) {
    console.error("rate read failed:", error.message)
    // RLS rejects ratings for reads that aren't finished yet.
    if (error.code === "42501") return { error: "This read can be rated once it’s marked finished." }
    return { error: "Could not save your rating. Try again." }
  }

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath(`/clubs/${clubId}/reads/${readNumber}`)
  return { success: "Rating saved." }
}

export async function submitBallotAction(
  clubId: string,
  sessionId: string,
  bookIds: string[],
): Promise<ActionState> {
  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return { error: "Rank at least one book." }
  }
  if (new Set(bookIds).size !== bookIds.length) {
    return { error: "Each book can only be ranked once." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("submit_ballot", {
    p_session_id: sessionId,
    p_book_ids: bookIds,
  })

  if (error) {
    if (error.code === "23505") return { error: "You already voted in this round." }
    console.error("submit_ballot failed:", error.message)
    return { error: friendly(error.message, "Could not submit your ballot.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Ballot submitted." }
}

export async function removeMemberAction(clubId: string, userId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("remove_club_member", { p_club_id: clubId, p_user_id: userId })

  if (error) {
    console.error("remove_club_member failed:", error.message)
    return { error: friendly(error.message, "Could not remove that member.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Member removed." }
}

export async function leaveClubAction(clubId: string): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in first." }

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id)

  if (error) {
    console.error("leave club failed:", error.message)
    return { error: "Could not leave the club." }
  }

  revalidatePath("/clubs")
  redirect("/clubs")
}

/** Organizer-only club updates. RLS limits updates to the organizer, so no row means not allowed. */
async function updateClub(
  clubId: string,
  values: { name?: string; max_nominations_per_member?: number },
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("clubs").update(values).eq("id", clubId).select("id")
  if (error) {
    console.error("club update failed:", error.message)
    return "Could not save that. Try again."
  }
  return data?.length ? null : RPC_MESSAGES.not_club_owner
}

export async function renameClubAction(clubId: string, rawName: string): Promise<ActionState> {
  const name = rawName.trim()
  if (name.length < 1) return { error: "Give your club a name." }
  if (name.length > 80) return { error: "Keep the name to 80 characters or fewer." }

  const error = await updateClub(clubId, { name })
  if (error) return { error }

  revalidatePath(`/clubs/${clubId}`)
  revalidatePath("/clubs")
  return { success: "Club renamed." }
}

export async function updateNominationLimitAction(clubId: string, limit: number): Promise<ActionState> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_NOMINATION_LIMIT) {
    return { error: `Pick a limit from 1 to ${MAX_NOMINATION_LIMIT}.` }
  }

  const error = await updateClub(clubId, { max_nominations_per_member: limit })
  if (error) return { error }

  revalidatePath(`/clubs/${clubId}`)
  return { success: limit === 1 ? "Each member can nominate 1 book per read." : `Each member can nominate up to ${limit} books per read.` }
}

export async function transferOwnershipAction(clubId: string, newOwnerId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("transfer_club_ownership", {
    p_club_id: clubId,
    p_new_owner_id: newOwnerId,
  })

  if (error) {
    console.error("transfer_club_ownership failed:", error.message)
    return { error: friendly(error.message, "Could not hand off the club. Try again.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "They’re the organizer now." }
}

export async function deleteClubAction(clubId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("clubs").delete().eq("id", clubId).select("id")

  if (error) {
    console.error("club delete failed:", error.message)
    return { error: "Could not delete the club. Try again." }
  }
  if (!data?.length) return { error: RPC_MESSAGES.not_club_owner }

  revalidatePath("/clubs")
  redirect("/clubs")
}

export async function readmitMemberAction(clubId: string, userId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("readmit_club_member", { p_club_id: clubId, p_user_id: userId })

  if (error) {
    console.error("readmit_club_member failed:", error.message)
    return { error: friendly(error.message, "Could not let them back in. Try again.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "They can rejoin with the join code." }
}

export async function cancelVotingAction(clubId: string, sessionId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_voting_session", { p_session_id: sessionId })

  if (error) {
    console.error("cancel_voting_session failed:", error.message)
    return { error: friendly(error.message, "Could not cancel the vote. Try again.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Vote cancelled. Nominations are open again." }
}

export async function updateManualBookAction(
  clubId: string,
  bookId: string,
  fields: ManualBookFields,
): Promise<ActionState> {
  const validated = validateManualBook(fields)
  if (!validated.book) return { error: validated.error }
  const { title, authors, publishedDate, pageCount } = validated.book

  const supabase = await createClient()
  const { error } = await supabase.rpc("update_manual_book", {
    p_book_id: bookId,
    p_title: title,
    p_authors: authors,
    p_published_date: publishedDate ?? "",
    p_page_count: pageCount,
  })

  if (error) {
    console.error("update_manual_book failed:", error.message)
    return { error: friendly(error.message, "Could not save the book. Try again.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Book updated." }
}
