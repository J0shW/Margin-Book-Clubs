"use client"

import { useEffect, useState } from "react"
import { daysUntil, formatReadDate, readingProgress, relativeDays } from "@/lib/reads"

type Props = {
  startDate: string | null
  discussionDate: string | null
  /** Show the reading-window progress bar (for the current read). */
  showProgress?: boolean
}

/**
 * Dates render on the server, but "in 3 weeks" and the progress bar depend on
 * the viewer's own today, so those fill in after mount instead of risking a
 * server/client mismatch across time zones.
 */
export function ReadDates({ startDate, discussionDate, showProgress = false }: Props) {
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => setToday(new Date()), [])

  if (!startDate && !discussionDate) {
    return <p className="text-sm text-muted-foreground">Dates TBD</p>
  }

  const progress = today && showProgress ? readingProgress(startDate, discussionDate, today) : null

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {startDate ? (
          <>
            <dt className="text-muted-foreground">Start</dt>
            <dd>{formatReadDate(startDate)}</dd>
          </>
        ) : null}
        {discussionDate ? (
          <>
            <dt className="text-muted-foreground">Discussion</dt>
            <dd>
              {formatReadDate(discussionDate)}
              {today ? (
                <span className="text-muted-foreground"> · {relativeDays(daysUntil(discussionDate, today))}</span>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
      {progress !== null ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Reading window elapsed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </div>
  )
}
