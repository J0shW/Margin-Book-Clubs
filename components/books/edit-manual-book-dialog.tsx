"use client"

import { useState } from "react"
import { PencilIcon } from "lucide-react"
import { updateManualBookAction } from "@/app/clubs/actions"
import { ManualBookForm } from "@/components/books/add-book-manually-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { Book } from "@/lib/types"

/** Fix the details of a book that was added by hand (search results come from the providers). */
export function EditManualBookDialog({ clubId, book }: { clubId: string; book: Book }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${book.title}`}>
            <PencilIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit book</DialogTitle>
          <DialogDescription>This book was added by hand, so its details can be corrected here.</DialogDescription>
        </DialogHeader>
        <ManualBookForm
          // Remount with fresh values each time it opens.
          key={String(open)}
          idPrefix={`edit-${book.id}`}
          initial={{
            title: book.title,
            authors: book.authors.join(", "),
            publishedYear: book.published_date?.slice(0, 4) ?? "",
            pageCount: book.page_count ? String(book.page_count) : "",
          }}
          submitLabel="Save"
          submit={(fields) => updateManualBookAction(clubId, book.id, fields)}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
