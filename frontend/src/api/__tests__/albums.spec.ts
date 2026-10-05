import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addAlbumLocation,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbums,
  removeAlbumLocation,
  updateAlbum,
} from '../albums'

afterEach(() => {
  vi.restoreAllMocks()
})

const sample = {
  id: 'alb-1',
  name: 'Summer trip',
  description: null,
  date: '2024-07-14',
  date_precision: 'day',
  immich_album_id: null,
  location_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function mockFetch(
  body: unknown = sample,
  ok = true,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

describe('albums api', () => {
  it('listAlbums GETs the collection', async () => {
    const fetchMock = mockFetch([sample])

    expect(await listAlbums()).toEqual([sample])
    expect(fetchMock).toHaveBeenCalledWith('/api/albums', { headers: {} })
  })

  it('getAlbum GETs one album', async () => {
    const fetchMock = mockFetch({ ...sample, locations: [] })

    await getAlbum('alb-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb-1', { headers: {} })
  })

  it('createAlbum POSTs the payload', async () => {
    const fetchMock = mockFetch()
    const input = {
      name: 'Summer trip',
      date: '2024-07-01',
      date_precision: 'month' as const,
    }

    await createAlbum(input)

    expect(fetchMock).toHaveBeenCalledWith('/api/albums', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  })

  it('updateAlbum PATCHes, keeping explicit nulls', async () => {
    const fetchMock = mockFetch()

    await updateAlbum('alb-1', { description: null })

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb-1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: '{"description":null}',
    })
  })

  it('deleteAlbum DELETEs and throws on failure', async () => {
    const fetchMock = mockFetch(undefined)

    await deleteAlbum('alb-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb-1', {
      method: 'DELETE',
      headers: {},
    })

    mockFetch(undefined, false)
    await expect(deleteAlbum('alb-1')).rejects.toThrow('500')
  })

  it('addAlbumLocation POSTs the location id', async () => {
    const fetchMock = mockFetch({ ...sample, locations: [] })

    await addAlbumLocation('alb-1', 'loc-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb-1/locations', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{"location_id":"loc-1"}',
    })
  })

  it('removeAlbumLocation DELETEs the membership', async () => {
    const fetchMock = mockFetch(undefined)

    await removeAlbumLocation('alb-1', 'loc-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/albums/alb-1/locations/loc-1',
      { method: 'DELETE', headers: {} },
    )
  })
})
