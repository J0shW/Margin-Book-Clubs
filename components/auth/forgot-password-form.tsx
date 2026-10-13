"use client"

import { useActionState } from "react"
import Link from "next/link"
import { requestPasswordResetAction, type AuthState } from "@/app/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestPasswordResetAction, null)

  if (state?.success) {
    return (
      <div className="flex flex-col gap-6">
        <Alert>
          <AlertDescription>
            {state.success} Open it in this browser. If it doesn’t arrive in a few minutes, check your spam folder.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/auth/login">Back to sign in</Link>} />
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
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/auth/login" className="text-foreground underline underline-offset-4 hover:text-primary">
          Sign in
        </Link>
      </p>
    </form>
  )
}
