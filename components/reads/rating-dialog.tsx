"use client"

import { useState, useTransition } from "react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { rateReadAction } from "@/app/clubs/actions"
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
import { Spinner } from "@/components/ui/spinner"
import { formatRating } from "@/lib/reads"

const MIN_HALVES = 1
const MAX_HALVES = 20
// Where the slider sits before a first rating. It isn't saved until the
// member moves it, so it can't nudge anyone toward a default score.
const STARTING_HALVES = 14

type Props = {
  clubId: string
  readId: string
  readNumber: number
  title: string
  /** The member's existing rating in half points, if any. */
  currentHalves: number | null
  triggerLabel: string
  triggerVariant?: "default" | "outline" | "ghost"
  onRated?: () => void
}

export function RatingDialog({
  clubId,
  readId,
  readNumber,
  title,
  currentHalves,
  triggerLabel,
  triggerVariant = "default",
  onRated,
}: Props) {
  const [open, setOpen] = useState(false)
  const [halves, setHalves] = useState(currentHalves ?? STARTING_HALVES)
  const [touched, setTouched] = useState(currentHalves !== null)
  const [pending, startTransition] = useTransition()

  function set(next: number) {
    setHalves(Math.min(MAX_HALVES, Math.max(MIN_HALVES, next)))
    setTouched(true)
  }

  function save() {
    startTransition(async () => {
      const result = await rateReadAction(clubId, readId, readNumber, halves)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? "Rating saved.")
      setOpen(false)
      onRated?.()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setHalves(currentHalves ?? STARTING_HALVES)
          setTouched(currentHalves !== null)
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
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-pretty">Rate “{title}”</DialogTitle>
          <DialogDescription>Out of 10, in half points. Everyone in the club can see your score.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          <p className="flex items-baseline gap-1" aria-live="polite">
            <span className={touched ? "font-serif text-6xl leading-none" : "font-serif text-6xl leading-none text-muted-foreground"}>
              {touched ? formatRating(halves / 2) : "–"}
            </span>
            <span className="text-sm text-muted-foreground">/ 10</span>
          </p>

          <div className="flex w-full items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => set(halves - 1)}
              disabled={pending || (touched && halves <= MIN_HALVES)}
              aria-label="Half a point lower"
            >
              <MinusIcon />
            </Button>
            <input
              type="range"
              min={MIN_HALVES}
              max={MAX_HALVES}
              step={1}
              value={halves}
              onChange={(e) => set(Number(e.target.value))}
              disabled={pending}
              aria-label="Your rating out of 10"
              aria-valuetext={`${formatRating(halves / 2)} out of 10`}
              className="h-11 min-w-0 flex-1 accent-primary"
            />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => set(halves + 1)}
              disabled={pending || (touched && halves >= MAX_HALVES)}
              aria-label="Half a point higher"
            >
              <PlusIcon />
            </Button>
          </div>
          {!touched ? <p className="text-xs text-muted-foreground">Drag or tap +/− to pick a score.</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending || !touched}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {currentHalves === null ? "Save rating" : "Update rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
