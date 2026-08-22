import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

const steps = [
  {
    title: "Nominate",
    body: "Every member searches millions of books and puts forward the titles they actually want to read.",
  },
  {
    title: "Rank",
    body: "Instead of one vote, each person orders the shortlist from first choice to last.",
  },
  {
    title: "Runoff",
    body: "Last-place books drop out and their ballots transfer, until one title holds a real majority.",
  },
]

const sampleRound = [
  { title: "The Left Hand of Darkness", votes: 4, leading: true },
  { title: "Piranesi", votes: 3, leading: false },
  { title: "The Overstory", votes: 2, leading: false },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-14 px-5 pb-16 pt-10">
      <header className="flex items-center justify-between">
        <span className="font-serif text-xl tracking-tight">Margin</span>
        {user ? (
          <Button size="sm" nativeButton={false} render={<Link href="/clubs">My clubs</Link>} />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/auth/login">Sign in</Link>}
          />
        )}
      </header>

      <section className="flex flex-col gap-6">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Ranked-choice book picking</p>
        <h1 className="font-serif text-5xl leading-[0.98] text-balance sm:text-6xl">
          Settle the next read without the group chat war.
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground text-pretty">
          Margin runs your book club&apos;s shortlist as an instant-runoff election, so the winner is the book the
          most people can genuinely live with.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            render={
              <Link href={user ? "/clubs" : "/auth/sign-up"}>{user ? "Go to my clubs" : "Start a club"}</Link>
            }
          />
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href={user ? "/clubs" : "/auth/login"}>Join with a code</Link>}
          />
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Round 2</p>
          <p className="font-mono text-xs text-muted-foreground">9 ballots</p>
        </div>
        <ul className="flex flex-col gap-3">
          {sampleRound.map((row) => (
            <li key={row.title} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{row.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.votes}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={row.leading ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-chart-3"}
                  style={{ width: `${(row.votes / 5) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          The last-place title is out. Its ballots move to each voter&apos;s next choice.
        </p>
      </div>

      <section className="flex flex-col gap-8">
        <h2 className="font-serif text-3xl">How a round works</h2>
        <div className="flex flex-col gap-8">
          {steps.map((step) => (
            <div key={step.title} className="flex flex-col gap-2 border-t border-border pt-5">
              <h3 className="font-serif text-2xl text-primary">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-xs text-muted-foreground">
        Margin — a small tool for clubs that read together.
      </footer>
    </main>
  )
}
