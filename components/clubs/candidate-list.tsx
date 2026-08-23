"use client"

import { useTransition } from "react"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { removeCandidateAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { BookDetailsDialog } from "@/components/books/book-details-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Candidate } from "@/lib/types"

type Props = {
  clubId: string
  candidates: Candidate[]
  currentUserId: string
  isOwner: boolean
  locked: boolean
}

export function CandidateList({ clubId, candidates, currentUserId, isOwner, locked }: Props) {
  const [pending, startTransition] = useTransition()

  function remove(candidateId: string) {
    startTransition(async () => {
      const result = await removeCandidateAction(clubId, candidateId)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Removed.")
    })
  }

  return (
    <ul className="flex flex-col">
      {candidates.map((candidate) => {
        const canRemove = !locked && (isOwner || candidate.added_by === currentUserId)
        return (
          <li key={candidate.id} className="flex items-center gap-3 border-t border-border py-4">
            <BookCover src={candidate.books.cover_image_url} title={candidate.books.title} className="w-14" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-serif text-lg leading-tight text-pretty">{candidate.books.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {candidate.books.authors.length ? candidate.books.authors.join(", ") : "Unknown author"}
                {candidate.books.page_count ? ` · ${candidate.books.page_count} pp.` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Nominated by {candidate.profiles?.display_name ?? "a member"}
              </p>
            </div>
            <BookDetailsDialog book={candidate.books} />
            {canRemove ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(candidate.id)}
                disabled={pending}
                aria-label={`Remove ${candidate.books.title}`}
              >
                {pending ? <Spinner /> : <XIcon />}
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
