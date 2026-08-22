import Link from "next/link"
import { redirect } from "next/navigation"
import { signOutAction } from "@/app/auth/actions"
import { ClubEntryForms } from "@/components/clubs/club-entry-forms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/server"

type ClubRow = {
  id: string
  name: string
  join_code: string
  owner_id: string
  current_book_id: string | null
}

export default async function ClubsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, clubs(id, name, join_code, owner_id, current_book_id)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })

  const clubs = (memberships ?? [])
    .map((m) => m.clubs as unknown as ClubRow | null)
    .filter((c): c is ClubRow => Boolean(c))

  const currentBookIds = clubs.map((c) => c.current_book_id).filter((id): id is string => Boolean(id))

  const { data: currentBooks } = currentBookIds.length
    ? await supabase.from("books").select("id, title").in("id", currentBookIds)
    : { data: [] }

  const titleById = new Map((currentBooks ?? []).map((b) => [b.id, b.title as string]))

  const { data: activeSessions } = clubs.length
    ? await supabase
        .from("voting_sessions")
        .select("club_id")
        .eq("status", "active")
        .in(
          "club_id",
          clubs.map((c) => c.id),
        )
    : { data: [] }

  const votingClubIds = new Set((activeSessions ?? []).map((s) => s.club_id as string))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-5 pb-16 pt-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="font-serif text-xl tracking-tight">
          Margin
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Your shelves</p>
          <h1 className="font-serif text-4xl leading-tight">Clubs</h1>
        </div>

        {clubs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No clubs yet</EmptyTitle>
              <EmptyDescription>Start one below, or join an existing club with its code.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {clubs.map((club) => {
              const currentTitle = club.current_book_id ? titleById.get(club.current_book_id) : undefined
              return (
                <li key={club.id} className="border-t border-border">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="flex items-center justify-between gap-4 py-5 transition-colors hover:text-primary"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="font-serif text-2xl leading-none">{club.name}</span>
                        {club.owner_id === user.id ? (
                          <Badge variant="secondary" className="shrink-0">
                            Organizer
                          </Badge>
                        ) : null}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {votingClubIds.has(club.id)
                          ? "Voting is open"
                          : currentTitle
                            ? `Reading ${currentTitle}`
                            : "No book chosen yet"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tracking-[0.2em] text-muted-foreground">
                      {club.join_code}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="font-serif text-2xl">Add a club</h2>
        <ClubEntryForms />
      </section>
    </main>
  )
}
