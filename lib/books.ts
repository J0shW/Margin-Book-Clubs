const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
}

/**
 * Descriptions arrive in two different dirty formats: Google Books sends HTML
 * fragments, and Open Library sends Markdown. We render descriptions as plain
 * text (never dangerouslySetInnerHTML), so flatten both here — otherwise raw
 * `**bold**` markers and `<p>` tags leak into the UI.
 */
export function stripHtml(input: string): string {
  return (
    input
      // HTML structure first, so block tags become real line breaks.
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?p[^>]*>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity)
      // Markdown links and images: keep the label, drop the target.
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Reference-style link definitions sit on their own line.
      .replace(/^\s*\[\d+\]:\s*\S+.*$/gm, "")
      .replace(/\[([^\]]*)\]\[\d+\]/g, "$1")
      // Emphasis markers, longest run first so *** collapses cleanly. Uses an
      // explicit [\s\S] rather than the dotAll flag to stay within the
      // project's TypeScript target, since emphasis can wrap across lines.
      .replace(/(\*\*\*|___)([\s\S]+?)\1/g, "$2")
      .replace(/(\*\*|__)([\s\S]+?)\1/g, "$2")
      .replace(/(^|[^\w*_])([*_])(?=\S)([\s\S]+?)(?<=\S)\2(?![\w*_])/g, "$1$3")
      // Headings, blockquotes, and horizontal rules.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/gm, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

/**
 * Boilerplate both providers append to synopses. It carries no information for
 * a reader deciding how to rank a book, so drop it.
 */
const CREDIT_PATTERNS = [
  /\s*this description (comes|came) from the publisher\.?\s*$/i,
  /\s*\(?this text refers to[^.)]*\.?\)?\s*$/i,
  /\s*-+\s*(back cover|publisher'?s description)\.?\s*$/i,
  // stripHtml has already flattened "([source][1])" down to "(source)".
  /\s*\(source\)\s*$/i,
]

/**
 * Turns a raw provider synopsis into clean plain text, or null when nothing
 * meaningful survives. Use this instead of calling stripHtml directly.
 */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null

  let text = stripHtml(raw)

  // Credits can stack, so keep peeling until nothing more matches.
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of CREDIT_PATTERNS) {
      const next = text.replace(pattern, "")
      if (next !== text) {
        text = next.trim()
        changed = true
      }
    }
  }

  return text.length > 0 ? text : null
}

/**
 * Open Library repeats an author once per edition record, so a single-author
 * book can come back as ["Richard Powers", "Richard Powers"]. Dedupe
 * case-insensitively while preserving the original order and spelling.
 */
export function cleanAuthors(raw: string[] | undefined, limit = 10): string[] {
  if (!raw?.length) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const name = entry.trim()
    if (!name) continue

    const key = name.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ")
    if (seen.has(key)) continue

    seen.add(key)
    result.push(name)
    if (result.length >= limit) break
  }

  return result
}

/** Lowercases and flattens hyphens so "sci-fi" and "sci fi" compare equal. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Provider subject data is noisy and inconsistent. Google sends BISAC paths
 * ("Fiction / Science Fiction / General"), while Open Library returns unordered
 * tags mixed with award metadata, translated duplicates, and theme keywords
 * ("nyt:hardcover-fiction=2021", "Ciencia-ficción", "human nature"). Matching
 * against a known vocabulary yields far better labels than generic string
 * cleaning, which otherwise surfaces award names and stray themes as genres.
 *
 * Declared most-specific first so "Science Fiction" is preferred over "Fiction".
 */
const GENRE_PATTERNS: { label: string; patterns: string[] }[] = [
  { label: "Historical Fiction", patterns: ["historical fiction"] },
  { label: "Literary Fiction", patterns: ["literary fiction"] },
  { label: "Science Fiction", patterns: ["science fiction", "sci fi", "scifi"] },
  { label: "Speculative Fiction", patterns: ["speculative fiction"] },
  { label: "Magical Realism", patterns: ["magical realism"] },
  { label: "Graphic Novel", patterns: ["graphic novel", "comics"] },
  { label: "Short Stories", patterns: ["short stories"] },
  { label: "Young Adult", patterns: ["young adult"] },
  { label: "Children’s", patterns: ["children", "juvenile"] },
  { label: "True Crime", patterns: ["true crime"] },
  { label: "Dystopian", patterns: ["dystopia", "dystopian"] },
  { label: "Fantasy", patterns: ["fantasy"] },
  { label: "Mystery", patterns: ["mystery", "detective"] },
  { label: "Thriller", patterns: ["thriller", "suspense"] },
  { label: "Horror", patterns: ["horror"] },
  { label: "Romance", patterns: ["romance"] },
  { label: "Adventure", patterns: ["adventure"] },
  { label: "Gothic", patterns: ["gothic"] },
  { label: "Western", patterns: ["western fiction", "westerns"] },
  { label: "Crime", patterns: ["crime"] },
  { label: "Classics", patterns: ["classics", "classic literature"] },
  { label: "Memoir", patterns: ["memoir", "autobiography"] },
  { label: "Biography", patterns: ["biography"] },
  { label: "Poetry", patterns: ["poetry", "poems"] },
  { label: "Essays", patterns: ["essays"] },
  { label: "Philosophy", patterns: ["philosophy"] },
  { label: "Psychology", patterns: ["psychology"] },
  { label: "Self-Help", patterns: ["self help", "personal development"] },
  { label: "Business", patterns: ["business", "economics"] },
  { label: "Politics", patterns: ["politics", "political science"] },
  { label: "History", patterns: ["history"] },
  { label: "Science", patterns: ["science"] },
  { label: "Humor", patterns: ["humor", "humour", "comedy"] },
  { label: "Nonfiction", patterns: ["nonfiction", "non fiction"] },
  { label: "Fiction", patterns: ["fiction"] },
]

/**
 * Normalizes genre labels from either provider into a short, readable list.
 */
export function cleanCategories(raw: string[] | undefined, limit = 3): string[] {
  if (!raw?.length) return []

  const entries = raw
    .filter((entry) => typeof entry === "string")
    // Award and bestseller-list metadata is never a genre.
    .filter((entry) => !entry.includes(":") && !entry.includes("="))

  if (!entries.length) return []

  // Walk entries in provider order, since both APIs list their most relevant
  // subjects first. Within a single entry, prefer the most specific genre.
  const matched: string[] = []

  for (const entry of entries) {
    const haystack = normalize(entry)

    for (const { label, patterns } of GENRE_PATTERNS) {
      if (matched.includes(label)) continue

      // Word-boundary match so a pattern cannot fire inside an unrelated word.
      const hit = patterns.some((pattern) =>
        new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack),
      )
      if (hit) matched.push(label)
    }
  }

  // Drop broader labels that a more specific match already implies, so a book
  // tagged both "Fiction" and "Science Fiction" only shows the latter.
  const specific = matched.filter(
    (label) =>
      !matched.some(
        (other) => other !== label && normalize(other).includes(normalize(label)),
      ),
  )

  return specific.slice(0, limit)
}

type OpenLibraryWork = {
  description?: string | { value?: string }
  subjects?: string[]
}

/**
 * Open Library's search endpoint only returns a first sentence, which is often
 * a fragment in another language. The work record carries the real synopsis and
 * cleaner subjects, so fetch it once at nomination time.
 */
export async function fetchOpenLibraryWork(
  workKey: string,
): Promise<{ description: string | null; subjects: string[] }> {
  const path = workKey.startsWith("/") ? workKey : `/${workKey}`
  const empty = { description: null, subjects: [] }

  try {
    const res = await fetch(`https://openlibrary.org${path}.json`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return empty

    const data = (await res.json()) as OpenLibraryWork
    const raw = typeof data.description === "string" ? data.description : data.description?.value

    return { description: cleanDescription(raw), subjects: data.subjects ?? [] }
  } catch {
    return empty
  }
}
