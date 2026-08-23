"use client"

import { useState, useTransition } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { toast } from "sonner"
import { submitBallotAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { BookDetailsDialog } from "@/components/books/book-details-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Book } from "@/lib/types"

type Props = {
  clubId: string
  sessionId: string
  books: Book[]
}

export function RankedBallot({ clubId, sessionId, books }: Props) {
  const [order, setOrder] = useState<Book[]>(books)
  const [pending, startTransition] = useTransition()

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function submit() {
    startTransition(async () => {
      const result = await submitBallotAction(
        clubId,
        sessionId,
        order.map((b) => b.id),
      )
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Ballot submitted.")
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Put your first choice at the top. If it gets eliminated, your vote transfers to the next book on your
        list.
      </p>

      <ol className="flex flex-col">
        {order.map((book, index) => (
          <li key={book.id} className="flex items-center gap-3 border-t border-border py-3">
            <span
              aria-hidden="true"
              className="w-5 shrink-0 font-mono text-sm text-primary"
            >
              {index + 1}
            </span>
            <BookCover src={book.cover_image_url} title={book.title} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-pretty text-sm font-medium">{book.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {book.authors.length ? book.authors.join(", ") : "Unknown author"}
              </p>
            </div>
            <BookDetailsDialog book={book} />
            <div className="flex shrink-0 flex-col">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, -1)}
                disabled={index === 0 || pending}
                aria-label={`Move ${book.title} up`}
              >
                <ChevronUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1 || pending}
                aria-label={`Move ${book.title} down`}
              >
                <ChevronDownIcon />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Button onClick={submit} disabled={pending} className="w-fit">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Submit ballot
      </Button>
    </div>
  )
}
