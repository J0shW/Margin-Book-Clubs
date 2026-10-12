"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { resolveVoteTieAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Book } from "@/lib/types"

type Props = {
  clubId: string
  sessionId: string
  books: Book[]
  isOwner: boolean
}

/** A vote that ended in a tie: the organizer picks the winner; members wait. */
export function TieBreaker({ clubId, sessionId, books, isOwner }: Props) {
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function pick(book: Book) {
    setPendingId(book.id)
    startTransition(async () => {
      const result = await resolveVoteTieAction(clubId, sessionId, book.id)
      setPendingId(null)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Winner picked.")
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-accent p-4">
      <div className="flex flex-col gap-1">
        <p className="font-serif text-xl">It’s a tie</p>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "The tiebreak rules couldn’t separate these books, so it’s your call. Pick the winner."
            : "The tiebreak rules couldn’t separate these books. The organizer will pick the winner."}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {books.map((book) => (
          <li key={book.id} className="flex items-center gap-3">
            <BookCover src={book.cover_image_url} title={book.title} className="w-10" />
            <span className="min-w-0 flex-1 text-sm font-medium text-pretty">{book.title}</span>
            {isOwner ? (
              <Button size="sm" disabled={pending} onClick={() => pick(book)}>
                {pendingId === book.id ? <Spinner data-icon="inline-start" /> : null}
                Pick
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
