"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateVotingMethodAction } from "@/app/clubs/actions"
import { Spinner } from "@/components/ui/spinner"
import { VOTING_METHODS } from "@/lib/voting"
import type { VotingMethod } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  clubId: string
  method: VotingMethod
  /** Only the organizer can change it; members see which one is in use. */
  canEdit: boolean
}

export function VotingMethodSetting({ clubId, method, canEdit }: Props) {
  const [selected, setSelected] = useState(method)
  const [pending, startTransition] = useTransition()

  function choose(next: VotingMethod) {
    if (next === selected || pending) return
    const previous = selected
    setSelected(next)
    startTransition(async () => {
      const result = await updateVotingMethodAction(clubId, next)
      if (result?.error) {
        setSelected(previous)
        toast.error(result.error)
      } else {
        toast.success(result?.success ?? "Saved.")
      }
    })
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={!canEdit || pending}>
      <legend className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
        Voting method
        {pending ? <Spinner className="size-3" /> : null}
      </legend>
      {VOTING_METHODS.map((option) => {
        const checked = selected === option.value
        return (
          <label
            key={option.value}
            className={cn(
              "flex gap-3 rounded-lg border p-3 text-sm",
              checked ? "border-primary bg-accent" : "border-border",
              canEdit ? "cursor-pointer" : "cursor-default",
            )}
          >
            <input
              type="radio"
              name="voting-method"
              value={option.value}
              checked={checked}
              onChange={() => choose(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">
                {option.label}
                {option.value === "consensus" ? <span className="font-normal text-muted-foreground"> · recommended</span> : null}
              </span>
              <span className="text-muted-foreground text-pretty">{option.description}</span>
            </span>
          </label>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {canEdit ? "Changes apply from the next vote; a vote already open keeps its method." : "Set by the organizer."}
      </p>
    </fieldset>
  )
}
