import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { SettingsForm } from "@/components/settings/settings-form"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-5 pb-16 pt-10">
      <header className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/clubs">
              <ArrowLeftIcon data-icon="inline-start" />
              Clubs
            </Link>
          }
        />
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Account</p>
        <h1 className="font-serif text-4xl leading-tight">Settings</h1>
      </div>

      <SettingsForm currentName={profile?.display_name ?? ""} />
    </main>
  )
}
