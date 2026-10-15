"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { addManualBookAction } from "@/app/clubs/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { type ManualBookFields, validateManualBook } from "@/lib/manual-book"
import type { ActionState } from "@/lib/types"

const EMPTY: ManualBookFields = { title: "", authors: "", publishedYear: "", pageCount: "" }

type FormProps = {
  /** Starting values; also prefixes the field ids so two forms can share a page. */
  initial?: ManualBookFields
  idPrefix: string
  submitLabel: string
  submit: (fields: ManualBookFields) => Promise<ActionState>
  onDone: () => void
  /** Clear the fields after a successful save. */
  resetOnSuccess?: boolean
}

/** Title, authors, year and page count for a book added by hand. */
export function ManualBookForm({ initial = EMPTY, idPrefix, submitLabel, submit, onDone, resetOnSuccess }: FormProps) {
  const [fields, setFields] = useState(initial)
  const [pending, startTransition] = useTransition()
  const set = (key: keyof ManualBookFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: e.target.value }))

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = validateManualBook(fields)
    if (error) {
      toast.error(error)
      return
    }

    startTransition(async () => {
      const result = await submit(fields)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? "Saved.")
      if (resetOnSuccess) setFields(EMPTY)
      onDone()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 py-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-title`}>Title</FieldLabel>
          <Input
            id={`${idPrefix}-title`}
            value={fields.title}
            onChange={set("title")}
            placeholder="The book's title"
            autoFocus
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-authors`}>Author(s)</FieldLabel>
          <Input
            id={`${idPrefix}-authors`}
            value={fields.authors}
            onChange={set("authors")}
            placeholder="Separate multiple authors with commas"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-year`}>Published year</FieldLabel>
            <Input
              id={`${idPrefix}-year`}
              value={fields.publishedYear}
              onChange={set("publishedYear")}
              placeholder="e.g. 2019"
              inputMode="numeric"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-pages`}>Page count</FieldLabel>
            <Input
              id={`${idPrefix}-pages`}
              value={fields.pageCount}
              onChange={set("pageCount")}
              placeholder="e.g. 320"
              inputMode="numeric"
            />
          </Field>
        </div>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="self-end">
        {pending ? <Spinner /> : submitLabel}
      </Button>
    </form>
  )
}

export function AddBookManuallyForm({ clubId, onAdded }: { clubId: string; onAdded: () => void }) {
  return (
    <ManualBookForm
      idPrefix="manual"
      submitLabel="Add book"
      submit={(fields) => addManualBookAction(clubId, fields)}
      onDone={onAdded}
      resetOnSuccess
    />
  )
}
