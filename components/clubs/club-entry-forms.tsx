"use client"

import { useActionState } from "react"
import { createClubAction, joinClubAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ActionState } from "@/lib/types"

export function ClubEntryForms() {
  const [createState, createFormAction, creating] = useActionState<ActionState, FormData>(createClubAction, null)
  const [joinState, joinFormAction, joining] = useActionState<ActionState, FormData>(joinClubAction, null)

  return (
    <Tabs defaultValue="create" className="gap-4">
      <TabsList>
        <TabsTrigger value="create">Start a club</TabsTrigger>
        <TabsTrigger value="join">Join a club</TabsTrigger>
      </TabsList>

      <TabsContent value="create">
        <form action={createFormAction} className="flex flex-col gap-4">
          {createState?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{createState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="club-name">Club name</FieldLabel>
            <Input id="club-name" name="name" required maxLength={80} placeholder="Tuesday Night Readers" />
            <FieldDescription>You&apos;ll get a join code to share with members.</FieldDescription>
          </Field>
          <Button type="submit" disabled={creating} className="w-fit">
            {creating ? <Spinner data-icon="inline-start" /> : null}
            Create club
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="join">
        <form action={joinFormAction} className="flex flex-col gap-4">
          {joinState?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{joinState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="join-code">Join code</FieldLabel>
            <Input
              id="join-code"
              name="code"
              required
              maxLength={6}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="A1B2C3"
              className="font-mono uppercase tracking-[0.3em]"
            />
            <FieldDescription>Six characters, from whoever runs the club.</FieldDescription>
          </Field>
          <Button type="submit" disabled={joining} className="w-fit">
            {joining ? <Spinner data-icon="inline-start" /> : null}
            Join club
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  )
}
