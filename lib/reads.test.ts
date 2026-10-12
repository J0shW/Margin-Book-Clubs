import { describe, expect, it } from "vitest"
import {
  averageRating,
  daysUntil,
  formatRating,
  formatReadDate,
  parseReadDate,
  readingProgress,
  relativeDays,
} from "@/lib/reads"

const today = new Date(2026, 9, 12, 21, 30) // Oct 12 2026, evening local time

describe("parseReadDate", () => {
  it("keeps the calendar day in local time", () => {
    const date = parseReadDate("2026-11-12")
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 12])
  })
})

describe("formatReadDate", () => {
  it("omits the year for dates this year", () => {
    expect(formatReadDate("2026-11-12", today)).toBe("Thu, Nov 12")
  })

  it("includes the year otherwise", () => {
    expect(formatReadDate("2027-01-05", today)).toBe("Tue, Jan 5, 2027")
  })
})

describe("daysUntil and relativeDays", () => {
  it("counts calendar days regardless of the time of day", () => {
    expect(daysUntil("2026-10-12", today)).toBe(0)
    expect(daysUntil("2026-10-13", today)).toBe(1)
    expect(daysUntil("2026-10-10", today)).toBe(-2)
  })

  it("describes the distance in words", () => {
    expect(relativeDays(0)).toBe("today")
    expect(relativeDays(1)).toBe("tomorrow")
    expect(relativeDays(-1)).toBe("yesterday")
    expect(relativeDays(5)).toBe("in 5 days")
    expect(relativeDays(21)).toBe("in 3 weeks")
    expect(relativeDays(-3)).toBe("3 days ago")
  })
})

describe("readingProgress", () => {
  it("is the share of the reading window that has passed", () => {
    expect(readingProgress("2026-10-02", "2026-10-22", today)).toBe(0.5)
  })

  it("clamps before the start and after the discussion", () => {
    expect(readingProgress("2026-11-01", "2026-12-01", today)).toBe(0)
    expect(readingProgress("2026-09-01", "2026-10-01", today)).toBe(1)
  })

  it("needs both dates", () => {
    expect(readingProgress(null, "2026-12-01", today)).toBeNull()
    expect(readingProgress("2026-10-01", null, today)).toBeNull()
  })
})

describe("ratings", () => {
  it("averages half-point scores out of 10", () => {
    expect(averageRating([17, 14])).toBe(7.75)
    expect(averageRating([])).toBeNull()
  })

  it("formats to one decimal, dropping .0", () => {
    expect(formatRating(7.75)).toBe("7.8")
    expect(formatRating(8)).toBe("8")
    expect(formatRating(8.5)).toBe("8.5")
  })
})
