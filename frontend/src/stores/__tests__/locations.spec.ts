import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLocationsStore } from '../locations'
import type { Location } from '../../api/locations'

vi.mock('../../api/locations', () => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationVisited: vi.fn(),
  deleteLocation: vi.fn(),
}))

import {
  createLocation,
  deleteLocation,
  listLocations,
  setLocationVisited,
  updateLocation,
} from '../../api/locations'

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'id-1',
    name: 'Berlin',
    lat: 52.52,
    lng: 13.405,
    country_code: 'DE',
    visited: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('locations store', () => {
  it('fetchAll loads locations into state', async () => {
    const loc = makeLocation()
    vi.mocked(listLocations).mockResolvedValue([loc])
    const store = useLocationsStore()

    await store.fetchAll()

    expect(store.locations).toEqual([loc])
    expect(store.error).toBeNull()
  })

  it('fetchAll surfaces an error message on failure', async () => {
    vi.mocked(listLocations).mockRejectedValue(new Error('boom'))
    const store = useLocationsStore()

    await store.fetchAll()

    expect(store.locations).toEqual([])
    expect(store.error).toBe('Failed to load locations.')
  })

  it('create appends the new location', async () => {
    const created = makeLocation({ id: 'new', name: 'Rome' })
    vi.mocked(createLocation).mockResolvedValue(created)
    const store = useLocationsStore()

    await store.create({ name: 'Rome', lat: 41.9, lng: 12.5 })

    expect(store.locations).toEqual([created])
  })

  it('update replaces the matching location', async () => {
    const original = makeLocation()
    const updated = makeLocation({ name: 'Renamed' })
    vi.mocked(listLocations).mockResolvedValue([original])
    vi.mocked(updateLocation).mockResolvedValue(updated)
    const store = useLocationsStore()
    await store.fetchAll()

    await store.update('id-1', { name: 'Renamed' })

    expect(store.locations).toEqual([updated])
  })

  it('remove drops the matching location', async () => {
    const loc = makeLocation()
    vi.mocked(listLocations).mockResolvedValue([loc])
    vi.mocked(deleteLocation).mockResolvedValue(undefined)
    const store = useLocationsStore()
    await store.fetchAll()

    await store.remove('id-1')

    expect(store.locations).toEqual([])
  })

  it('setVisited replaces the location with the server-updated flag', async () => {
    const loc = makeLocation({ visited: false })
    const visited = makeLocation({ visited: true })
    vi.mocked(listLocations).mockResolvedValue([loc])
    vi.mocked(setLocationVisited).mockResolvedValue(visited)
    const store = useLocationsStore()
    await store.fetchAll()

    const result = await store.setVisited('id-1', true)

    expect(setLocationVisited).toHaveBeenCalledWith('id-1', true)
    expect(result).toEqual(visited)
    expect(store.locations).toEqual([visited])
  })
})
