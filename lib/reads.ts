/**
 * Read dates are calendar dates ("2026-11-12") with no time zone. Parsing them
 * with `new Date("2026-11-12")` reads them as UTC midnight, which shows as the
 * previous day anywhere west of UTC, so build a local date instead.
 */
export function parseReadDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** "Thu, Nov 12", with the year added when it isn't the current one. */
export function formatReadDate(value: string, today: Date = new Date()): string {
  const date = parseReadDate(value)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  })
}

/** "Nov 2026", for compact lists of past reads. */
export function formatReadMonth(value: string | Date): string {
  const date = typeof value === "string" ? parseReadDate(value) : value
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole days from today to the date; negative once it has passed. */
export function daysUntil(value: string, today: Date = new Date()): number {
  const ms = parseReadDate(value).getTime() - startOfDay(today).getTime()
  return Math.round(ms / 86_400_000)
}

/** "today", "tomorrow", "in 5 days", "in 3 weeks", "2 days ago", … */
export function relativeDays(days: number): string {
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  const abs = Math.abs(days)
  const amount = abs >= 14 ? `${Math.round(abs / 7)} weeks` : `${abs} days`
  return days > 0 ? `in ${amount}` : `${amount} ago`
}

/**
 * How far through the reading window today is, from 0 to 1, or null without
 * both dates.
 */
export function readingProgress(
  startDate: string | null,
  discussionDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!startDate || !discussionDate) return null
  const total = daysUntil(discussionDate, today) - daysUntil(startDate, today)
  if (total <= 0) return null
  const elapsed = -daysUntil(startDate, today)
  return Math.min(1, Math.max(0, elapsed / total))
}

/** Ratings are stored as half points (1–20). Returns the average out of 10. */
export function averageRating(scoreHalves: number[]): number | null {
  if (scoreHalves.length === 0) return null
  return scoreHalves.reduce((sum, halves) => sum + halves, 0) / scoreHalves.length / 2
}

/** "8.5", "7", "6.3": one decimal place, dropping a trailing ".0". */
export function formatRating(rating: number): string {
  return String(Math.round(rating * 10) / 10)
}
