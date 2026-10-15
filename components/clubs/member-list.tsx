"use client"

import { useState, useTransition } from "react"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { removeMemberAction } from "@/app/clubs/actions"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type Member = { user_id: string; profiles: { display_name: string | null } | null }

type Props = {
  clubId: string
  members: Member[]
  ownerId: string
  isOwner: boolean
}

export function MemberList({ clubId, members, ownerId, isOwner }: Props) {
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  function remove(member: Member) {
    setPendingId(member.user_id)
    startTransition(async () => {
      const result = await removeMemberAction(clubId, member.user_id)
      setPendingId(null)
      if (result?.error) toast.error(result.error)
      else toast.success(result?.success ?? "Member removed.")
    })
  }

  const removeTargetName = removeTarget?.profiles?.display_name ?? "This member"

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {members.map((member) => {
          const name = member.profiles?.display_name ?? "Member"
          const isClubOwner = member.user_id === ownerId
          return (
            <li key={member.user_id} className="flex items-center">
              <Badge variant={isClubOwner ? "default" : "outline"}>{name}</Badge>
              {isOwner && !isClubOwner ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRemoveTarget(member)}
                  disabled={pending}
                  aria-label={`Remove ${name} from the club`}
                >
                  {pendingId === member.user_id ? <Spinner /> : <XIcon />}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTargetName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll lose access to this club and can’t rejoin with the join code unless you let them back in. Their nominations
              and any ballots already cast stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) remove(removeTarget)
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
