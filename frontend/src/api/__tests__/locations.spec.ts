import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
} from '../locations'

afterEach(() => {
  vi.restoreAllMocks()
})

const sample = {
  id: 'abc',
  name: 'Berlin',
  lat: 52.52,
  lng: 13.405,
  country_code: 'DE',
  visited: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('listLocations', () => {
  it('GETs the collection and returns the parsed list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([sample]) })
    vi.stubGlobal('fetch', fetchMock)

    expect(await listLocations()).toEqual([sample])
    expect(fetchMock).toHaveBeenCalledWith('/api/locations')
  })

  it('throws on an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )
    await expect(listLocations()).rejects.toThrow('500')
  })
})

describe('createLocation', () => {
  it('POSTs JSON and returns the created location', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocation({
      name: 'Berlin',
      lat: 52.52,
      lng: 13.405,
    })

    expect(result).toEqual(sample)
    expect(fetchMock).toHaveBeenCalledWith('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Berlin', lat: 52.52, lng: 13.405 }),
    })
  })
})

describe('updateLocation', () => {
  it('PATCHes the given id with a partial payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(sample) })
    vi.stubGlobal('fetch', fetchMock)

    await updateLocation('abc', { name: 'Renamed' })

    expect(fetchMock).toHaveBeenCalledWith('/api/locations/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    })
  })
})

describe('deleteLocation', () => {
  it('DELETEs the given id and resolves on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteLocation('abc')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/locations/abc', {
      method: 'DELETE',
    })
  })

  it('throws on an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    )
    await expect(deleteLocation('abc')).rejects.toThrow('404')
  })
})
