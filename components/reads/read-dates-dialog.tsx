"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { startNextReadAction, updateReadDatesAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type Props = {
  clubId: string
  /** Edit this read's dates; without it, the dialog opens the next read. */
  readId?: string
  readNumber?: number
  startDate?: string | null
  discussionDate?: string | null
  triggerLabel: string
  triggerVariant?: "default" | "outline" | "ghost"
}

export function ReadDatesDialog({
  clubId,
  readId,
  readNumber,
  startDate = null,
  discussionDate = null,
  triggerLabel,
  triggerVariant = "outline",
}: Props) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(startDate ?? "")
  const [discussion, setDiscussion] = useState(discussionDate ?? "")
  const [pending, startTransition] = useTransition()
  const creating = !readId

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (start && discussion && discussion < start) {
      toast.error("The discussion date can’t be before the start date.")
      return
    }

    startTransition(async () => {
      const result = creating
        ? await startNextReadAction(clubId, start || null, discussion || null)
        : await updateReadDatesAction(clubId, readId, start || null, discussion || null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? "Saved.")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Reset to the saved dates each time it opens.
        if (next) {
          setStart(startDate ?? "")
          setDiscussion(discussionDate ?? "")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size="sm">
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={save} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {creating ? "Start the next read" : `Dates for read #${readNumber}`}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? "Members can start nominating right away. Dates are optional; you can set them later."
                : "Leave a date empty if it isn’t decided yet."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="read-start">Start reading</FieldLabel>
              <Input id="read-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="read-discussion">Discussion</FieldLabel>
              <Input
                id="read-discussion"
                type="date"
                value={discussion}
                min={start || undefined}
                onChange={(e) => setDiscussion(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {creating ? "Open nominations" : "Save dates"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
