import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <AuthShell
      eyebrow="Margin"
      title="That link didn’t work"
      description="Email links expire, work only once, and need to be opened in the browser you asked for them from. Try signing in, or request a new link."
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
        <Button
          variant="ghost"
          className="w-full"
          nativeButton={false}
          render={<Link href="/auth/forgot-password">Reset your password</Link>}
        />
      </div>
    </AuthShell>
  )
}
