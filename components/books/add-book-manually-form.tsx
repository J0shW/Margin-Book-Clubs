"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { addManualBookAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function AddBookManuallyForm({ clubId, onAdded }: { clubId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [publishedYear, setPublishedYear] = useState("")
  const [pageCount, setPageCount] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (title.trim().length < 1) {
      toast.error("Give the book a title.")
      return
    }

    const parsedPageCount = pageCount.trim() ? Number(pageCount) : null
    if (parsedPageCount !== null && !Number.isFinite(parsedPageCount)) {
      toast.error("Page count must be a number.")
      return
    }

    startTransition(async () => {
      const result = await addManualBookAction(clubId, {
        title,
        authors: authors
          .split(",")
          .map((author) => author.trim())
          .filter(Boolean),
        publishedDate: publishedYear.trim() || null,
        pageCount: parsedPageCount,
      })

      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? "Book added.")
      setTitle("")
      setAuthors("")
      setPublishedYear("")
      setPageCount("")
      onAdded()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 py-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="manual-title">Title</FieldLabel>
          <Input
            id="manual-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The book's title"
            autoFocus
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="manual-authors">Author(s)</FieldLabel>
          <Input
            id="manual-authors"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Separate multiple authors with commas"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="manual-year">Published year</FieldLabel>
            <Input
              id="manual-year"
              value={publishedYear}
              onChange={(e) => setPublishedYear(e.target.value)}
              placeholder="e.g. 2019"
              inputMode="numeric"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="manual-pages">Page count</FieldLabel>
            <Input
              id="manual-pages"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              placeholder="e.g. 320"
              inputMode="numeric"
            />
          </Field>
        </div>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="self-end">
        {pending ? <Spinner /> : "Add book"}
      </Button>
    </form>
  )
}
