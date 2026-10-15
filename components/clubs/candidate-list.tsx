"use client"

import { useState, useTransition } from "react"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { removeCandidateAction } from "@/app/clubs/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BookCover } from "@/components/books/book-cover"
import { BookDetailsDialog } from "@/components/books/book-details-dialog"
import { EditManualBookDialog } from "@/components/books/edit-manual-book-dialog"
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
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Candidate | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  function remove(candidateId: string) {
    setRemovingId(candidateId)
    startTransition(async () => {
      const result = await removeCandidateAction(clubId, candidateId)
      setRemovingId(null)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Removed.")
    })
  }

  return (
    <>
      <ul className="flex flex-col">
        {candidates.map((candidate) => {
          const canManage = isOwner || candidate.added_by === currentUserId
          const canRemove = !locked && canManage
          // Typos in hand-added books can be fixed even once voting has started.
          const canEdit = canManage && candidate.books.source_id.startsWith("manual:")
          return (
            <li key={candidate.id} className="flex items-center gap-3 border-t border-border py-4">
              <button
                type="button"
                onClick={() => setOpenDetailsId(candidate.id)}
                className="-my-4 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md py-4 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <BookCover src={candidate.books.cover_image_url} title={candidate.books.title} className="w-14" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-serif text-lg leading-tight text-pretty">{candidate.books.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {candidate.books.authors.length ? candidate.books.authors.join(", ") : "Unknown author"}
                    {candidate.books.page_count ? ` · ${candidate.books.page_count} pp.` : ""}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Nominated by {candidate.profiles?.display_name ?? "a member"}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col">
                <BookDetailsDialog
                  book={candidate.books}
                  open={openDetailsId === candidate.id}
                  onOpenChange={(open) => setOpenDetailsId(open ? candidate.id : null)}
                />
                {canEdit ? <EditManualBookDialog clubId={clubId} book={candidate.books} /> : null}
                {canRemove ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoveTarget(candidate)}
                    disabled={pending}
                    aria-label={`Remove ${candidate.books.title}`}
                  >
                    {removingId === candidate.id ? <Spinner /> : <XIcon />}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this book?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget ? `“${removeTarget.books.title}” will be taken off the shortlist.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) remove(removeTarget.id)
                setRemoveTarget(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
