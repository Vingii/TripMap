import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAlbumsStore } from '../albums'
import type { Album, AlbumDetail } from '../../api/albums'
import type { Location } from '../../api/locations'

vi.mock('../../api/albums', () => ({
  listAlbums: vi.fn(),
  getAlbum: vi.fn(),
  createAlbum: vi.fn(),
  updateAlbum: vi.fn(),
  deleteAlbum: vi.fn(),
  addAlbumLocation: vi.fn(),
  removeAlbumLocation: vi.fn(),
}))

import {
  addAlbumLocation,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeAlbumLocation,
  updateAlbum,
} from '../../api/albums'

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: 'alb-1',
    name: 'Summer trip',
    description: null,
    date: '2024-07-14',
    date_precision: 'day',
    immich_album_id: null,
    location_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeLocation(id: string): Location {
  return {
    id,
    name: id,
    lat: 0,
    lng: 0,
    country_code: null,
    subdivision_codes: [],
    visited: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makeDetail(
  locations: Location[] = [],
  overrides: Partial<Album> = {},
): AlbumDetail {
  return {
    ...makeAlbum({ location_count: locations.length, ...overrides }),
    locations,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('albums store', () => {
  it('fetchAll loads albums', async () => {
    vi.mocked(listAlbums).mockResolvedValue([makeAlbum()])
    const store = useAlbumsStore()

    await store.fetchAll()

    expect(store.albums).toEqual([makeAlbum()])
    expect(store.error).toBeNull()
  })

  it('fetchAll records an error on failure', async () => {
    vi.mocked(listAlbums).mockRejectedValue(new Error('boom'))
    const store = useAlbumsStore()

    await store.fetchAll()

    expect(store.error).toBe('Failed to load albums.')
  })

  it('fetchOne loads the current album', async () => {
    const detail = makeDetail([makeLocation('loc-1')])
    vi.mocked(getAlbum).mockResolvedValue(detail)
    const store = useAlbumsStore()

    await store.fetchOne('alb-1')

    expect(store.current).toEqual(detail)
  })

  it('create inserts the album in date order without its locations', async () => {
    vi.mocked(listAlbums).mockResolvedValue([
      makeAlbum({ id: 'new', date: '2025-01-01' }),
      makeAlbum({ id: 'old', date: '2020-01-01' }),
    ])
    vi.mocked(createAlbum).mockResolvedValue(
      makeDetail([], { id: 'mid', date: '2022-06-01' }),
    )
    const store = useAlbumsStore()
    await store.fetchAll()

    await store.create({
      name: 'Mid',
      date: '2022-06-01',
      date_precision: 'day',
    })

    expect(store.albums.map((a) => a.id)).toEqual(['new', 'mid', 'old'])
    expect(store.albums[1]).not.toHaveProperty('locations')
  })

  it('update refreshes both the list entry and the current album', async () => {
    vi.mocked(getAlbum).mockResolvedValue(makeDetail())
    vi.mocked(listAlbums).mockResolvedValue([makeAlbum()])
    vi.mocked(updateAlbum).mockResolvedValue(
      makeDetail([], { name: 'Renamed' }),
    )
    const store = useAlbumsStore()
    await store.fetchAll()
    await store.fetchOne('alb-1')

    await store.update('alb-1', { name: 'Renamed' })

    expect(store.albums[0].name).toBe('Renamed')
    expect(store.current?.name).toBe('Renamed')
  })

  it('remove drops the album', async () => {
    vi.mocked(listAlbums).mockResolvedValue([makeAlbum()])
    vi.mocked(deleteAlbum).mockResolvedValue()
    const store = useAlbumsStore()
    await store.fetchAll()

    await store.remove('alb-1')

    expect(deleteAlbum).toHaveBeenCalledWith('alb-1')
    expect(store.albums).toEqual([])
  })

  it('addLocation applies the returned album', async () => {
    vi.mocked(getAlbum).mockResolvedValue(makeDetail())
    vi.mocked(addAlbumLocation).mockResolvedValue(
      makeDetail([makeLocation('loc-1')]),
    )
    const store = useAlbumsStore()
    await store.fetchOne('alb-1')

    await store.addLocation('alb-1', 'loc-1')

    expect(store.current?.locations.map((l) => l.id)).toEqual(['loc-1'])
    expect(store.albums[0].location_count).toBe(1)
  })

  it('removeLocation drops it from the current album and the count', async () => {
    const locations = [makeLocation('loc-1'), makeLocation('loc-2')]
    vi.mocked(getAlbum).mockResolvedValue(makeDetail(locations))
    vi.mocked(listAlbums).mockResolvedValue([makeAlbum({ location_count: 2 })])
    vi.mocked(removeAlbumLocation).mockResolvedValue()
    const store = useAlbumsStore()
    await store.fetchAll()
    await store.fetchOne('alb-1')

    await store.removeLocation('alb-1', 'loc-1')

    expect(removeAlbumLocation).toHaveBeenCalledWith('alb-1', 'loc-1')
    expect(store.current?.locations.map((l) => l.id)).toEqual(['loc-2'])
    expect(store.current?.location_count).toBe(1)
    expect(store.albums[0].location_count).toBe(1)
  })
})
