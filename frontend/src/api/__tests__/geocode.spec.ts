import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces } from '../geocode'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('searchPlaces', () => {
  it('skips the request and returns [] for a blank query', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requests the trimmed, encoded query and returns the parsed results', async () => {
    const payload = [
      { name: 'Berlin, Germany', lat: 52.52, lng: 13.405, country_code: 'DE' },
    ]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchPlaces('  São Paulo  ')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/geocode/search?q=S%C3%A3o%20Paulo',
      expect.anything(),
    )
    expect(results).toEqual(payload)
  })

  it('throws when the backend responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 }),
    )

    await expect(searchPlaces('Berlin')).rejects.toThrow('502')
  })
})
