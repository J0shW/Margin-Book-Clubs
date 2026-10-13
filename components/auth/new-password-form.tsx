"use client"

import { useActionState } from "react"
import Link from "next/link"
import { updatePasswordAction, type AuthState } from "@/app/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePasswordAction, null)

  if (state?.success) {
    return (
      <div className="flex flex-col gap-6">
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
        <Button className="w-full" nativeButton={false} render={<Link href="/clubs">Go to your clubs</Link>} />
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Save password
      </Button>
    </form>
  )
}
