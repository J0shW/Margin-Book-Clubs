import { signInAction } from "@/app/auth/actions"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Margin"
      title="Back to the reading list"
      description="Sign in to nominate books and cast your ranked ballot."
    >
      <AuthForm mode="sign-in" action={signInAction} />
    </AuthShell>
  )
}
