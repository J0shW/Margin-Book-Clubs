"use client"

import { InfoIcon } from "lucide-react"
import { BookCover } from "@/components/books/book-cover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Book } from "@/lib/types"

type Props = {
  book: Book
}

export function BookDetailsDialog({ book }: Props) {
  const authors = book.authors.length ? book.authors.join(", ") : "Unknown author"
  const categories = book.categories ?? []

  const facts = [
    book.published_date ? book.published_date.slice(0, 4) : null,
    book.page_count ? `${book.page_count} pp.` : null,
  ].filter(Boolean) as string[]

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Details for ${book.title}`}>
            <InfoIcon />
          </Button>
        }
      />
      {/*
        The dialog itself never scrolls — only the description does. Otherwise a
        long synopsis scrolls the title and cover out of view and the panel reads
        as clipped on short viewports.
      */}
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden sm:max-w-md">
        <div className="flex shrink-0 gap-4 pr-8">
          <BookCover src={book.cover_image_url} title={book.title} className="w-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <DialogTitle className="font-serif text-xl leading-tight text-pretty">
              {book.title}
            </DialogTitle>
            <DialogDescription className="text-xs">{authors}</DialogDescription>
            {facts.length ? (
              <p className="font-mono text-xs text-muted-foreground">{facts.join(" · ")}</p>
            ) : null}
          </div>
        </div>

        {categories.length ? (
          <ul className="mt-5 flex shrink-0 flex-wrap gap-1.5">
            {categories.map((category) => (
              <li key={category}>
                <Badge variant="outline" className="font-normal">
                  {category}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-border pt-4">
          {book.description ? (
            <div className="flex flex-col gap-3">
              {book.description
                .split(/\n{2,}/)
                .slice(0, 8)
                .map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-pretty text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No description was available for this edition.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
