import { signUpAction } from "@/app/auth/actions"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Margin"
      title="Start a shelf of your own"
      description="Create an account to run a club, or join one with a six-character code."
    >
      <AuthForm mode="sign-up" action={signUpAction} />
    </AuthShell>
  )
}
