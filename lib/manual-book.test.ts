import { describe, expect, it } from "vitest"
import { validateManualBook } from "./manual-book"

const fields = (overrides: Partial<Parameters<typeof validateManualBook>[0]> = {}) => ({
  title: "Piranesi",
  authors: "Susanna Clarke",
  publishedYear: "",
  pageCount: "",
  ...overrides,
})

describe("validateManualBook", () => {
  it("accepts a title alone", () => {
    expect(validateManualBook(fields({ authors: "" }))).toEqual({
      book: { title: "Piranesi", authors: [], publishedDate: null, pageCount: null },
    })
  })

  it("trims and splits authors, and parses year and pages", () => {
    expect(
      validateManualBook(fields({ title: "  Good Omens ", authors: "Terry Pratchett, Neil Gaiman,", publishedYear: " 1990 ", pageCount: "412" })),
    ).toEqual({
      book: { title: "Good Omens", authors: ["Terry Pratchett", "Neil Gaiman"], publishedDate: "1990", pageCount: 412 },
    })
  })

  it("requires a title", () => {
    expect(validateManualBook(fields({ title: "   " })).error).toBe("Give the book a title.")
  })

  it("rejects bad years", () => {
    for (const publishedYear of ["19x0", "0", "-5", "12345", "2028", "1990.5"]) {
      expect(validateManualBook(fields({ publishedYear }), 2026).error).toMatch(/Published year/)
    }
    expect(validateManualBook(fields({ publishedYear: "2027" }), 2026).book?.publishedDate).toBe("2027")
    expect(validateManualBook(fields({ publishedYear: "0850" }), 2026).book?.publishedDate).toBe("850")
  })

  it("rejects bad page counts", () => {
    for (const pageCount of ["abc", "0", "-3", "12.5", "1e3", "20001"]) {
      expect(validateManualBook(fields({ pageCount })).error).toMatch(/Page count/)
    }
  })
})
