import { describe, expect, it } from 'vitest'
import {
  changelogEntries,
  entriesAfter,
  parseEntry,
  sortEntries,
  type ChangelogEntry,
} from '../index'

function entry(id: string, date: string): ChangelogEntry {
  return { id, date, title: id, body: '' }
}

describe('parseEntry', () => {
  it('reads frontmatter and the markdown body', () => {
    const parsed = parseEntry(
      '---\nid: v0.3.0\ndate: 2026-05-09\ntitle: "Zones: now faster"\n---\n\n- one\n',
      'a.md',
    )

    expect(parsed).toEqual({
      id: 'v0.3.0',
      date: '2026-05-09',
      // Only the first colon separates key from value; quotes are stripped.
      title: 'Zones: now faster',
      body: '- one',
    })
  })

  it.each([
    ['no frontmatter', 'just text'],
    ['a missing id', '---\ndate: 2026-05-09\ntitle: T\n---\n'],
    ['a non-ISO date', '---\nid: x\ndate: May 9\ntitle: T\n---\n'],
    ['a missing title', '---\nid: x\ndate: 2026-05-09\n---\n'],
  ])('rejects %s', (_case, raw) => {
    expect(() => parseEntry(raw, 'bad.md')).toThrow('bad.md')
  })
})

describe('sortEntries', () => {
  it('orders newest first, then by id within a day', () => {
    const sorted = sortEntries([
      entry('a', '2026-01-01'),
      entry('c', '2026-03-01'),
      entry('b1', '2026-02-01'),
      entry('b2', '2026-02-01'),
    ])

    expect(sorted.map((e) => e.id)).toEqual(['c', 'b2', 'b1', 'a'])
  })

  it('rejects duplicate ids', () => {
    expect(() =>
      sortEntries([entry('x', '2026-01-01'), entry('x', '2026-02-01')]),
    ).toThrow('duplicate')
  })
})

describe('entriesAfter', () => {
  const entries = [
    entry('c', '2026-03-01'),
    entry('b', '2026-02-01'),
    entry('a', '2026-01-01'),
  ]

  it('returns the entries newer than the marker', () => {
    expect(entriesAfter(entries, 'a')?.map((e) => e.id)).toEqual(['c', 'b'])
    expect(entriesAfter(entries, 'c')).toEqual([])
  })

  it('returns null for no marker or an unknown one', () => {
    expect(entriesAfter(entries, null)).toBeNull()
    expect(entriesAfter(entries, 'gone')).toBeNull()
  })
})

describe('bundled entries', () => {
  it('parse and are sorted newest first', () => {
    expect(changelogEntries.length).toBeGreaterThan(0)
    expect(sortEntries(changelogEntries)).toEqual(changelogEntries)
  })
})
