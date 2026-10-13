import { describe, expect, it } from "vitest"
import { safeNextPath } from "./safe-redirect"

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/clubs")).toBe("/clubs")
    expect(safeNextPath("/auth/reset-password")).toBe("/auth/reset-password")
    expect(safeNextPath("/clubs/abc?tab=1#x")).toBe("/clubs/abc?tab=1#x")
  })

  it("falls back for missing or relative values", () => {
    expect(safeNextPath(null)).toBe("/clubs")
    expect(safeNextPath("")).toBe("/clubs")
    expect(safeNextPath("clubs")).toBe("/clubs")
    expect(safeNextPath(undefined, "/")).toBe("/")
  })

  it("rejects anything that leaves the site", () => {
    for (const next of [
      "//evil.com",
      "/\\evil.com",
      "@evil.com",
      ".evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
      "/%2F%2Fevil.com/../..//evil.com",
    ]) {
      const result = safeNextPath(next)
      expect(new URL(result, "https://site.example").origin).toBe("https://site.example")
    }
    expect(safeNextPath("//evil.com")).toBe("/clubs")
    expect(safeNextPath("https://evil.com")).toBe("/clubs")
  })
})
