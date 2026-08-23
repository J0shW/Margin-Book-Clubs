"use client"

import { useActionState } from "react"
import { updateDisplayNameAction } from "@/app/settings/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { ActionState } from "@/lib/types"

export function SettingsForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateDisplayNameAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.success ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            defaultValue={currentName}
            placeholder="How members see you"
            maxLength={60}
            required
          />
          <FieldDescription>This is what other club members see next to your nominations and votes.</FieldDescription>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Save
      </Button>
    </form>
  )
}
