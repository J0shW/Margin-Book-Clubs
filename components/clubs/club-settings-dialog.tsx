"use client"

import { SettingsIcon } from "lucide-react"
import { JoinCode } from "@/components/clubs/join-code"
import { MemberList } from "@/components/clubs/member-list"
import { LeaveClubButton } from "@/components/clubs/organizer-controls"
import {
  ClubNameSetting,
  DeleteClubSetting,
  HandOffSetting,
  NominationLimitSetting,
} from "@/components/clubs/organizer-settings"
import { VotingMethodSetting } from "@/components/clubs/voting-method-setting"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { VotingMethod } from "@/lib/types"

type Member = { user_id: string; profiles: { display_name: string | null } | null }

type Props = {
  clubId: string
  clubName: string
  joinCode: string
  members: Member[]
  ownerId: string
  isOwner: boolean
  votingMethod: VotingMethod
  nominationLimit: number
}

/** Join code, members, club rules and organizer tools: things needed rarely, kept off the main page. */
export function ClubSettingsDialog({
  clubId,
  clubName,
  joinCode,
  members,
  ownerId,
  isOwner,
  votingMethod,
  nominationLimit,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Club settings and members">
            <SettingsIcon />
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85dvh] flex-col gap-6 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{clubName}</DialogTitle>
          <DialogDescription>Share the join code to invite people.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Join code</span>
          <JoinCode code={joinCode} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs uppercase tracking-[0.24em] text-primary">
            {members.length} {members.length === 1 ? "member" : "members"}
          </h3>
          <MemberList clubId={clubId} members={members} ownerId={ownerId} isOwner={isOwner} />
        </div>

        {isOwner ? (
          <div className="border-t border-border pt-6">
            <ClubNameSetting key={clubName} clubId={clubId} name={clubName} />
          </div>
        ) : null}

        <VotingMethodSetting clubId={clubId} method={votingMethod} canEdit={isOwner} />

        <NominationLimitSetting
          key={nominationLimit}
          clubId={clubId}
          limit={nominationLimit}
          canEdit={isOwner}
        />

        {isOwner ? (
          <div className="flex flex-col gap-6 border-t border-border pt-6">
            <HandOffSetting clubId={clubId} members={members} ownerId={ownerId} />
            <DeleteClubSetting clubId={clubId} clubName={clubName} />
          </div>
        ) : (
          <div className="border-t border-border pt-4">
            <LeaveClubButton clubId={clubId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
