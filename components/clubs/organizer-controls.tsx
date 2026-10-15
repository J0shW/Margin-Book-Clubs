"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  cancelVotingAction,
  closeVotingAction,
  finishReadAction,
  leaveClubAction,
  startVotingAction,
} from "@/app/clubs/actions"
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

export function FinishReadButton({
  clubId,
  readId,
  title,
  upNextTitle,
}: {
  clubId: string
  readId: string
  title: string
  upNextTitle?: string
}) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function finish() {
    startTransition(async () => {
      const result = await finishReadAction(clubId, readId)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Read marked finished.")
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Mark finished
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Members will be able to rate it.
              {upNextTitle ? ` “${upNextTitle}” becomes the current read.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false)
                finish()
              }}
            >
              Mark finished
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CancelVotingButton({ clubId, sessionId, ballots }: { clubId: string; sessionId: string; ballots: number }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function cancel() {
    startTransition(async () => {
      const result = await cancelVotingAction(clubId, sessionId)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Vote cancelled.")
    })
  }

  return (
    <>
      <Button variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Cancel vote
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this vote?</AlertDialogTitle>
            <AlertDialogDescription>
              {ballots === 0
                ? "Nobody has voted yet."
                : ballots === 1
                  ? "The 1 ballot cast so far will be discarded."
                  : `The ${ballots} ballots cast so far will be discarded.`}{" "}
              Nominations reopen with the same shortlist, and you can open a new vote when you’re ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep voting</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false)
                cancel()
              }}
            >
              Cancel vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
