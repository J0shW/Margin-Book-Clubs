"use client"

import { useEffect, useState, useTransition } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { nominateBookAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { BookSearchResult } from "@/lib/types"

export function NominateBookDialog({ clubId, disabled }: { clubId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setSearched(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? "search_failed")
        setResults(data.results ?? [])
        setSearched(true)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Book search is unavailable right now.")
        }
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  function nominate(book: BookSearchResult) {
    setPendingId(book.sourceId)
    startTransition(async () => {
      const result = await nominateBookAction(clubId, book)
      setPendingId(null)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? "Book nominated.")
      setOpen(false)
      setQuery("")
      setResults([])
      setSearched(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={disabled} size="sm">
            <PlusIcon data-icon="inline-start" />
            Nominate a book
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nominate a book</DialogTitle>
          <DialogDescription>Search by title or author and add a book to the shortlist.</DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author, or ISBN"
            autoFocus
            aria-label="Search books"
          />
          {searching ? (
            <InputGroupAddon align="inline-end">
              <Spinner />
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <div className="flex max-h-[22rem] flex-col overflow-y-auto">
          {searching && results.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-t border-border py-3">
                  <Skeleton className="aspect-[2/3] w-12 rounded-sm" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            : null}

          {results.map((book) => (
            <div key={book.sourceId} className="flex items-center gap-3 border-t border-border py-3">
              <BookCover src={book.coverImageUrl} title={book.title} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-medium">{book.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {book.authors.length ? book.authors.join(", ") : "Unknown author"}
                  {book.publishedDate ? ` · ${book.publishedDate.slice(0, 4)}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nominate(book)}
                disabled={pendingId !== null}
                aria-label={`Nominate ${book.title}`}
              >
                {pendingId === book.sourceId ? <Spinner /> : "Add"}
              </Button>
            </div>
          ))}

          {searched && !searching && results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No books matched that search.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
