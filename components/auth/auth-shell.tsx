import Link from "next/link"
import type { ReactNode } from "react"

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-primary hover:text-primary/80 w-fit"
          >
            {eyebrow}
          </Link>
          <h1 className="font-serif text-4xl leading-[1.05] text-balance">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
        </div>
        {children}
      </div>
    </main>
  )
}
