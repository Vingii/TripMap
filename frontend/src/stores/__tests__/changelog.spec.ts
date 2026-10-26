import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChangelogStore } from '../changelog'
import type { ChangelogEntry } from '../../changelog'

const getChangelogLastSeen = vi.fn()
const setChangelogLastSeen = vi.fn()

vi.mock('../../api/me', () => ({
  getChangelogLastSeen: () => getChangelogLastSeen() as unknown,
  setChangelogLastSeen: (id: string) => setChangelogLastSeen(id) as unknown,
}))

const ENTRIES: ChangelogEntry[] = [
  { id: 'c', date: '2026-03-01', title: 'C', body: '' },
  { id: 'b', date: '2026-02-01', title: 'B', body: '' },
  { id: 'a', date: '2026-01-01', title: 'A', body: '' },
]

function store(lastSeen: string | null): ReturnType<typeof useChangelogStore> {
  getChangelogLastSeen.mockResolvedValue({ last_seen_entry_id: lastSeen })
  setChangelogLastSeen.mockImplementation((id: string) =>
    Promise.resolve({ last_seen_entry_id: id }),
  )
  const changelog = useChangelogStore()
  changelog.entries = ENTRIES
  return changelog
}

beforeEach(() => {
  setActivePinia(createPinia())
  getChangelogLastSeen.mockReset()
  setChangelogLastSeen.mockReset()
})

describe('changelog store', () => {
  it('silently marks the newest entry seen on first run', async () => {
    const changelog = store(null)

    await changelog.load()

    expect(setChangelogLastSeen).toHaveBeenCalledWith('c')
    expect(changelog.hasUnseen).toBe(false)
  })

  it('treats a marker for a removed entry like a first run', async () => {
    const changelog = store('deleted-entry')

    await changelog.load()

    expect(setChangelogLastSeen).toHaveBeenCalledWith('c')
    expect(changelog.hasUnseen).toBe(false)
  })

  it('reports entries added since the marker', async () => {
    const changelog = store('a')

    await changelog.load()

    expect(changelog.hasUnseen).toBe(true)
    expect(changelog.unseen.map((e) => e.id)).toEqual(['c', 'b'])
    expect(setChangelogLastSeen).not.toHaveBeenCalled()
  })

  it('has nothing unseen when up to date', async () => {
    const changelog = store('c')

    await changelog.load()

    expect(changelog.hasUnseen).toBe(false)
  })

  it('marks everything seen on close', async () => {
    const changelog = store('a')
    await changelog.load()
    changelog.show()

    await changelog.close()

    expect(changelog.open).toBe(false)
    expect(setChangelogLastSeen).toHaveBeenCalledWith('c')
    expect(changelog.hasUnseen).toBe(false)
  })

  it('does not save again when closing while already up to date', async () => {
    const changelog = store('c')
    await changelog.load()
    changelog.show()

    await changelog.close()

    expect(setChangelogLastSeen).not.toHaveBeenCalled()
  })

  it('forgets the marker on reset', async () => {
    const changelog = store('a')
    await changelog.load()

    changelog.reset()

    expect(changelog.loaded).toBe(false)
    expect(changelog.hasUnseen).toBe(false)
  })
})
