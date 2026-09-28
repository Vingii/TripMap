import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const collection = { type: 'FeatureCollection', features: [] }

async function importLoaders() {
  return import('../index')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('zone layer loaders', () => {
  it('fetches each layer from its own asset url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(collection),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadCountryZones, loadSubdivisionZones } = await importLoaders()
    expect(await loadCountryZones()).toEqual(collection)
    expect(await loadSubdivisionZones()).toEqual(collection)

    const [[admin0Url], [admin1Url]] = fetchMock.mock.calls
    expect(admin0Url).toContain('admin-0')
    expect(admin1Url).toContain('admin-1')
  })

  it('fetches once and reuses the result for later calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(collection),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { loadCountryZones } = await importLoaders()
    const [first, second] = await Promise.all([
      loadCountryZones(),
      loadCountryZones(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('throws on an error response and retries on the next call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(collection),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { loadCountryZones } = await importLoaders()
    await expect(loadCountryZones()).rejects.toThrow(
      'Failed to load zone geometry (404)',
    )
    expect(await loadCountryZones()).toEqual(collection)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
