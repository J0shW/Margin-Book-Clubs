import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <AuthShell
      eyebrow="Margin"
      title="That link didn’t work"
      description="The confirmation link may have expired or already been used. Try signing in, or create the account again."
    >
      <div className="flex flex-col gap-3">
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link href="/auth/login">Sign in</Link>}
        />
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/auth/sign-up">Create an account</Link>}
        />
      </div>
    </AuthShell>
  )
}
