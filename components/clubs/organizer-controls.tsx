"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { closeVotingAction, leaveClubAction, startVotingAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function StartVotingButton({ clubId, disabled }: { clubId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await startVotingAction(clubId)
          if (result?.error) toast.error(result.error)
          else toast.success(result?.success ?? "Voting is open.")
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      Open voting
    </Button>
  )
}

export function CloseVotingButton({ clubId, sessionId }: { clubId: string; sessionId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await closeVotingAction(clubId, sessionId)
          if (result?.error) toast.error(result.error)
          else toast.success(result?.success ?? "Results are in.")
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      Close voting and tally
    </Button>
  )
}

export function LeaveClubButton({ clubId }: { clubId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await leaveClubAction(clubId)
          if (result?.error) toast.error(result.error)
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      Leave club
    </Button>
  )
}
