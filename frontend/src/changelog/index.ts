// Release notes shown in the in-app changelog dialog.
//
// Each entry is a markdown file in ./entries with a small frontmatter block:
//
//   ---
//   id: 2026-10-26
//   date: 2026-10-26
//   title: Feedback and changelog
//   ---
//   Markdown body…
//
// `id` is what the backend stores as the user's last-seen entry, so treat it as
// immutable once shipped — renaming it re-pops the entry for every user.

export interface ChangelogEntry {
  id: string
  // ISO date (YYYY-MM-DD).
  date: string
  title: string
  // Raw markdown; render through `renderMarkdown` from ./render.
  body: string
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parse one entry file; throws when its frontmatter is missing or invalid so
 * a malformed entry fails the build/tests rather than shipping silently. */
export function parseEntry(raw: string, source: string): ChangelogEntry {
  const match = FRONTMATTER.exec(raw)
  if (!match) throw new Error(`${source}: missing frontmatter`)
  const fields = new Map<string, string>()
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
    fields.set(line.slice(0, separator).trim(), value)
  }
  const id = fields.get('id')
  const date = fields.get('date')
  const title = fields.get('title')
  if (!id) throw new Error(`${source}: frontmatter needs an id`)
  if (!date || !ISO_DATE.test(date)) {
    throw new Error(`${source}: frontmatter needs an ISO date`)
  }
  if (!title) throw new Error(`${source}: frontmatter needs a title`)
  return { id, date, title, body: match[2].trim() }
}

/** Newest first: by date, then by id for entries sharing a date. Ids must be
 * unique, since the last-seen marker points at one. */
export function sortEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error(`duplicate changelog entry id: ${entry.id}`)
    }
    seen.add(entry.id)
  }
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  )
}

/**
 * Entries newer than `lastSeenId`, newest first. Returns null when that id is
 * not a known entry (never recorded, or the entry was since removed), which the
 * store treats like a first run rather than guessing what is new.
 */
export function entriesAfter(
  entries: ChangelogEntry[],
  lastSeenId: string | null,
): ChangelogEntry[] | null {
  const index = entries.findIndex((entry) => entry.id === lastSeenId)
  return index === -1 ? null : entries.slice(0, index)
}

const files = import.meta.glob<string>('./entries/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const changelogEntries: ChangelogEntry[] = sortEntries(
  Object.entries(files).map(([path, raw]) => parseEntry(raw, path)),
)
