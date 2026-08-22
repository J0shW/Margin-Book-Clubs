"use client"

import { useEffect, useState, useTransition } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { nominateBookAction } from "@/app/clubs/actions"
import { BookCover } from "@/components/books/book-cover"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddBookManuallyForm } from "@/components/books/add-book-manually-form"
import type { BookSearchResult } from "@/lib/types"

function sourceLabel(sourceId: string) {
  if (sourceId.startsWith("gb:")) return "Google Books"
  if (sourceId.startsWith("ol:")) return "Open Library"
  return null
}

export function NominateBookDialog({ clubId, disabled }: { clubId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [tab, setTab] = useState("search")
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
      close()
    })
  }

  function close() {
    setOpen(false)
    setQuery("")
    setResults([])
    setSearched(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setTab("search")
      }}
    >
      <DialogTrigger
        render={
          <Button disabled={disabled} size="sm">
            <PlusIcon data-icon="inline-start" />
            Nominate a book
          </Button>
        }
      />
      <DialogContent className="max-w-lg" initialFocus={false}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nominate a book</DialogTitle>
          <DialogDescription>Search by title or author, or add a book by hand.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as string)} className="min-w-0">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">
              Search
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              Add manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, author, or ISBN"
                aria-label="Search books"
              />
              {searching ? (
                <InputGroupAddon align="inline-end">
                  <Spinner />
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <div className="flex min-w-0 max-h-[22rem] flex-col overflow-y-auto">
              {searching && results.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex min-w-0 items-center gap-3 border-t border-border py-3">
                      <Skeleton className="aspect-[2/3] w-12 rounded-sm" />
                      <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                : null}

              {results.map((book) => (
                <div key={book.sourceId} className="flex min-w-0 items-center gap-3 border-t border-border py-3">
                  <BookCover src={book.coverImageUrl} title={book.title} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-medium">{book.title}</p>
                      <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
                        {sourceLabel(book.sourceId)}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {book.authors.length ? book.authors.join(", ") : "Unknown author"}
                      {book.publishedDate ? ` · ${book.publishedDate.slice(0, 4)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => nominate(book)}
                    disabled={pendingId !== null}
                    aria-label={`Nominate ${book.title}`}
                  >
                    {pendingId === book.sourceId ? <Spinner /> : "Add"}
                  </Button>
                </div>
              ))}

              {searched && !searching && results.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <p>No books matched that search.</p>
                  <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setTab("manual")}>
                    Add it manually instead
                  </Button>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <AddBookManuallyForm clubId={clubId} onAdded={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
