"use server"

import { cleanCategories, fetchOpenLibraryWork } from "@/lib/books"
import { createClient } from "@/lib/supabase/server"
import type { ActionState, BookSearchResult } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const RPC_MESSAGES: Record<string, string> = {
  invalid_join_code: "No club matches that code.",
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
    console.log("[v0] create_club failed:", error.message)
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
    console.log("[v0] join_club failed:", error.message)
    return { error: friendly(error.message, "Could not join that club. Try again.") }
  }

  revalidatePath("/clubs")
  redirect(`/clubs/${data as string}`)
}

/**
 * Returns the catalog id for a book, inserting it only when it is new.
 * Returns null if the row could neither be found nor created.
 */
async function findOrCreateBook(
  supabase: Awaited<ReturnType<typeof createClient>>,
  book: BookSearchResult,
): Promise<string | null> {
  const existing = await supabase.from("books").select("id").eq("source_id", book.sourceId).maybeSingle()

  if (existing.data) return existing.data.id

  // Only pay for the extra metadata lookup when actually inserting. Open
  // Library's search endpoint returns just a first sentence (often a fragment
  // in another language), so the work record supplies the real synopsis.
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

  // Another request may have inserted the same book between our select and
  // insert, so treat a unique violation as a hit and re-read the row.
  if (inserted.error?.code === "23505") {
    const raced = await supabase.from("books").select("id").eq("source_id", book.sourceId).maybeSingle()
    if (raced.data) return raced.data.id
  }

  console.log("[v0] book insert failed:", inserted.error?.message)
  return null
}

export async function nominateBookAction(clubId: string, book: BookSearchResult): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to nominate a book." }

  // `books` is a shared catalog keyed by source_id, so a book another club
  // already nominated is reused rather than rewritten. An upsert would issue an
  // UPDATE here, which RLS blocks by design — one club must not be able to edit
  // metadata that every other club reads.
  const bookId = await findOrCreateBook(supabase, book)
  if (!bookId) return { error: "Could not save that book. Try again." }

  const { error } = await supabase.from("club_candidate_books").insert({
    club_id: clubId,
    book_id: bookId,
    added_by: user.id,
  })

  if (error) {
    if (error.code === "23505") return { error: "That book is already nominated." }
    console.log("[v0] nominate failed:", error.message)
    return { error: "Could not nominate that book." }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: `“${book.title}” nominated.` }
}

export async function removeCandidateAction(clubId: string, candidateId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from("club_candidate_books").delete().eq("id", candidateId)

  if (error) {
    console.log("[v0] remove candidate failed:", error.message)
    return { error: "Could not remove that nomination." }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Nomination removed." }
}

export async function startVotingAction(clubId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("start_voting_session", { p_club_id: clubId })

  if (error) {
    console.log("[v0] start_voting_session failed:", error.message)
    return { error: friendly(error.message, "Could not start the vote.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Voting is open." }
}

export async function closeVotingAction(clubId: string, sessionId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("close_voting_session", { p_session_id: sessionId })

  if (error) {
    console.log("[v0] close_voting_session failed:", error.message)
    return { error: friendly(error.message, "Could not close the vote.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Results are in." }
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
    console.log("[v0] submit_ballot failed:", error.message)
    return { error: friendly(error.message, "Could not submit your ballot.") }
  }

  revalidatePath(`/clubs/${clubId}`)
  return { success: "Ballot submitted." }
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
    console.log("[v0] leave club failed:", error.message)
    return { error: "Could not leave the club." }
  }

  revalidatePath("/clubs")
  redirect("/clubs")
}
