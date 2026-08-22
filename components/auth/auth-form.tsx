"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import type { AuthState } from "@/app/auth/actions"

type Props = {
  mode: "sign-in" | "sign-up"
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
}

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null)
  const isSignUp = mode === "sign-up"

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        {isSignUp ? (
          <Field>
            <FieldLabel htmlFor="displayName">Display name</FieldLabel>
            <Input id="displayName" name="displayName" autoComplete="name" placeholder="How members see you" />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            placeholder="••••••••"
          />
          {isSignUp ? <FieldDescription>At least 8 characters.</FieldDescription> : null}
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {isSignUp ? "Create account" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New here? "}
        <Link
          href={isSignUp ? "/auth/login" : "/auth/sign-up"}
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}
