import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Margin"
      title="Reset your password"
      description="Enter the email you signed up with and we’ll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
