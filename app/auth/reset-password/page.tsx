import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

// Reached from a reset email (via /auth/callback, which signs the person in)
// or from Settings while signed in.
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <AuthShell
        eyebrow="Margin"
        title="That link has expired"
        description="Password reset links work once and expire after an hour. Request a new one."
      >
        <Button className="w-full" nativeButton={false} render={<Link href="/auth/forgot-password">Send a new link</Link>} />
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow="Margin" title="Choose a new password" description={`For ${user.email}.`}>
      <NewPasswordForm />
    </AuthShell>
  )
}
