"use client"

import { useEffect, useState } from "react"
import { StarIcon, XIcon } from "lucide-react"
import { RatingDialog } from "@/components/reads/rating-dialog"
import { Button } from "@/components/ui/button"

type Props = {
  clubId: string
  readId: string
  readNumber: number
  title: string
}

function storageKey(readId: string) {
  return `margin:rating-prompt-dismissed:${readId}`
}

/**
 * Asks a member to rate the club's most recently finished read until they do
 * or dismiss it. Dismissal is a per-device convenience; the read page always
 * offers rating too. Hidden until mounted so a dismissed prompt doesn't flash.
 */
export function RatingPrompt({ clubId, readId, readNumber, title }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(storageKey(readId)) === "1"
    } catch {
      // Storage can be unavailable (private mode); just show the prompt.
    }
    setVisible(!dismissed)
  }, [readId])

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(storageKey(readId), "1")
    } catch {
      // Nothing to persist to; it reappears next visit.
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-accent p-4">
      <StarIcon className="size-5 shrink-0 fill-primary text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-pretty">
        How was <span className="font-medium">{title}</span>?
      </p>
      <RatingDialog
        clubId={clubId}
        readId={readId}
        readNumber={readNumber}
        title={title}
        currentHalves={null}
        triggerLabel="Rate it"
        onRated={() => setVisible(false)}
      />
      <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss rating reminder">
        <XIcon />
      </Button>
    </div>
  )
}
