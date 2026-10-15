"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  deleteClubAction,
  renameClubAction,
  transferOwnershipAction,
  updateNominationLimitAction,
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
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { MAX_NOMINATION_LIMIT, nominationLimitText } from "@/lib/clubs"
import type { ActionState } from "@/lib/types"

type Member = { user_id: string; profiles: { display_name: string | null } | null }

const SELECT_CLASS =
  "h-9 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"

function SettingLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs uppercase tracking-[0.24em] text-primary">
      {children}
    </label>
  )
}

function report(result: ActionState) {
  if (result?.error) toast.error(result.error)
  else if (result?.success) toast.success(result.success)
}

export function ClubNameSetting({ clubId, name }: { clubId: string; name: string }) {
  const [value, setValue] = useState(name)
  const [pending, startTransition] = useTransition()
  const changed = value.trim() !== name && value.trim().length > 0

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!changed) return
    startTransition(async () => report(await renameClubAction(clubId, value)))
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <SettingLabel htmlFor="club-name">Club name</SettingLabel>
      <div className="flex gap-2">
        <Input
          id="club-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={80}
          className="h-9"
          disabled={pending}
        />
        <Button type="submit" size="sm" className="h-9" disabled={!changed || pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </div>
    </form>
  )
}

export function NominationLimitSetting({
  clubId,
  limit,
  canEdit,
}: {
  clubId: string
  limit: number
  canEdit: boolean
}) {
  const [selected, setSelected] = useState(limit)
  const [pending, startTransition] = useTransition()

  function choose(next: number) {
    const previous = selected
    setSelected(next)
    startTransition(async () => {
      const result = await updateNominationLimitAction(clubId, next)
      if (result?.error) setSelected(previous)
      report(result)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingLabel htmlFor="nomination-limit">Nominations per read</SettingLabel>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <select
            id="nomination-limit"
            value={selected}
            onChange={(e) => choose(Number(e.target.value))}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {Array.from({ length: MAX_NOMINATION_LIMIT }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {nominationLimitText(n)}
              </option>
            ))}
          </select>
          {pending ? <Spinner className="size-4" /> : null}
        </div>
      ) : (
        <p className="text-sm">{nominationLimitText(limit)}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {canEdit
          ? "Lowering it doesn’t remove nominations already made."
          : "Set by the organizer."}
      </p>
    </div>
  )
}

export function HandOffSetting({ clubId, members, ownerId }: { clubId: string; members: Member[]; ownerId: string }) {
  const candidates = members.filter((member) => member.user_id !== ownerId)
  const [targetId, setTargetId] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const targetName = candidates.find((member) => member.user_id === targetId)?.profiles?.display_name ?? "this member"

  function transfer() {
    startTransition(async () => {
      const result = await transferOwnershipAction(clubId, targetId)
      report(result)
      if (!result?.error) setTargetId("")
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingLabel htmlFor="hand-off">Hand off organizer</SettingLabel>
      {candidates.length ? (
        <div className="flex gap-2">
          <select
            id="hand-off"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={pending}
            className={`${SELECT_CLASS} flex-1`}
          >
            <option value="">Choose a member</option>
            {candidates.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profiles?.display_name ?? "Member"}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!targetId || pending}
            onClick={() => setConfirming(true)}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Hand off
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Once someone joins, you can make them the organizer.</p>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {targetName} the organizer?</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll run votes, manage reads and members, and can change these settings. You’ll stay in the club
              as a member, and only they can make you organizer again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false)
                transfer()
              }}
            >
              Hand off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function DeleteClubSetting({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [pending, startTransition] = useTransition()
  const matches = typed.trim() === clubName

  function remove() {
    startTransition(async () => {
      // Redirects to /clubs on success.
      const result = await deleteClubAction(clubId)
      report(result)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingLabel>Delete club</SettingLabel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Removes the club and all its reads, votes and ratings.</p>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            setTyped("")
            setConfirming(true)
          }}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Delete club
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {clubName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every member loses access, and its reads, nominations, votes and ratings are deleted for good. This
              can’t be undone. Type the club’s name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={clubName}
            aria-label="Club name"
            className="h-9"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!matches}
              onClick={() => {
                setConfirming(false)
                remove()
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
