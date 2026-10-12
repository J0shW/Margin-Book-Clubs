"use client"

import { useTransition } from "react"
import { StarIcon } from "lucide-react"
import { toast } from "sonner"
import { reopenReadAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatRating, formatReadMonth } from "@/lib/reads"
import type { Read } from "@/lib/types"

type Props = {
  clubId: string
  reads: Read[]
  /** Average out of 10 per read id, when anyone has rated it. */
  averages: Record<string, number>
  /** The organizer can reopen the most recent one while nothing is current. */
  reopenableId: string | null
}

export function PastReads({ clubId, reads, averages, reopenableId }: Props) {
  const [pending, startTransition] = useTransition()

  function reopen(readId: string) {
    startTransition(async () => {
      const result = await reopenReadAction(clubId, readId)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Read reopened.")
    })
  }

  return (
    <ul className="flex flex-col">
      {reads.map((read) => {
        const average = averages[read.id]
        const when = read.discussion_date ?? read.finished_at
        return (
          <li key={read.id} className="flex items-center gap-3 border-t border-border py-3">
            <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">#{read.number}</span>
            <BookCover src={read.books?.cover_image_url ?? null} title={read.books?.title ?? "?"} className="w-10" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium text-pretty">{read.books?.title ?? "Unknown book"}</p>
              <p className="text-xs text-muted-foreground">{when ? formatReadMonth(when.slice(0, 10)) : null}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {average !== undefined ? (
                <span className="flex items-center gap-1 font-mono text-sm" aria-label={`Club average ${formatRating(average)} out of 10`}>
                  <StarIcon className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                  {formatRating(average)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not rated</span>
              )}
              {read.id === reopenableId ? (
                <Button variant="ghost" size="xs" disabled={pending} onClick={() => reopen(read.id)}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Reopen
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
