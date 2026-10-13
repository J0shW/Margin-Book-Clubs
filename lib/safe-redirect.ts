/**
 * Returns `next` if it's a path on this site, otherwise `fallback`. Used for
 * redirect targets that arrive in a URL, so a crafted link can't send people
 * to another site after signing in (`//evil.com`, `/\evil.com`, `@evil.com`).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/clubs"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  try {
    const base = "https://margin.invalid"
    const url = new URL(next, base)
    if (url.origin !== base) return fallback
    const path = `${url.pathname}${url.search}${url.hash}`
    // Normalizing can turn "/a/..//evil.com" into "//evil.com", which a
    // browser reads as another host, so check the result again.
    return path.startsWith("//") || path.startsWith("/\\") ? fallback : path
  } catch {
    return fallback
  }
}
