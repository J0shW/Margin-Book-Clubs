"use client"

import { useState, useTransition } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { renominateBooksAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export type CarryOverBook = {
  bookId: string
  title: string
  nominatedBy: string | null
  mine: boolean
}

type Props = {
  clubId: string
  previousReadNumber: number
  books: CarryOverBook[]
  /** How many more books this member can nominate in the next read. */
  remaining: number
}

/**
 * Books from the previous read that didn't win and aren't nominated yet. Your
 * own come pre-checked so bringing them back is one tap; anyone else's can be
 * picked up individually.
 */
export function CarryOver({ clubId, previousReadNumber, books, remaining }: Props) {
  const mine = books.filter((book) => book.mine)
  const others = books.filter((book) => !book.mine)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(mine.map((book) => book.bookId)))
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function nominate(bookIds: string[], single?: string) {
    setPendingId(single ?? null)
    startTransition(async () => {
      const result = await renominateBooksAction(clubId, bookIds)
      setPendingId(null)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Nominated.")
    })
  }

  if (books.length === 0 || remaining <= 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {mine.length ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Bring back your nominations from read #{previousReadNumber}?</p>
          <ul className="flex flex-col gap-2">
            {mine.map((book) => (
              <li key={book.bookId}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.has(book.bookId)}
                    onChange={(e) => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(book.bookId)
                      else next.delete(book.bookId)
                      setSelected(next)
                    }}
                  />
                  <span className="min-w-0 text-pretty">{book.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="w-fit"
            disabled={pending || selected.size === 0}
            onClick={() => nominate([...selected].slice(0, remaining))}
          >
            {pending && pendingId === null ? <Spinner data-icon="inline-start" /> : null}
            {selected.size > remaining ? `Add ${remaining} of these` : "Add these"}
          </Button>
        </div>
      ) : null}

      {others.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Also didn’t win last time:</p>
          <ul className="flex flex-wrap gap-2">
            {others.map((book) => (
              <li key={book.bookId}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => nominate([book.bookId], book.bookId)}
                  aria-label={`Nominate ${book.title}`}
                  className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left"
                >
                  {pendingId === book.bookId ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                  <span className="min-w-0">
                    {book.title}
                    {book.nominatedBy ? <span className="text-muted-foreground"> · {book.nominatedBy}</span> : null}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
