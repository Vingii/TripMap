import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Geometry } from 'geojson'
import type { ZoneCollection, ZoneProperties } from '../../assets/geo'
import type { Location } from '../../api/locations'
import {
  boundsOf,
  countryZones,
  subdivisionZones,
  useZonesStore,
  zoneTooltip,
  type ZoneFeatureCollection,
} from '../zones'

vi.mock('../../assets/geo', () => ({
  loadCountryZones: vi.fn(),
  loadSubdivisionZones: vi.fn(),
}))

const { loadCountryZones, loadSubdivisionZones } =
  await import('../../assets/geo')

/** A unit square offset so each fixture polygon is distinguishable. */
function square(x: number, y: number): Geometry {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y],
      ],
    ],
  }
}

function collection(
  features: Array<{ properties: ZoneProperties; geometry?: Geometry }>,
): ZoneCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f, i) => ({
      type: 'Feature',
      geometry: f.geometry ?? square(i, 0),
      properties: f.properties,
    })),
  }
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: crypto.randomUUID(),
    name: 'Somewhere',
    lat: 0,
    lng: 0,
    country_code: null,
    subdivision_code: null,
    visited: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('countryZones', () => {
  const countries = collection([
    { properties: { name: 'France', country_code: 'FR' } },
    { properties: { name: 'Germany', country_code: 'DE' } },
    { properties: { name: 'Siachen Glacier' } },
  ])

  it('counts locations per country and leaves the rest at zero', () => {
    const result = countryZones(countries, [
      makeLocation({ country_code: 'FR' }),
      makeLocation({ country_code: 'FR' }),
      makeLocation({ country_code: 'DE' }),
    ])

    expect(result.features.map((f) => f.properties)).toEqual([
      { key: 'FR', name: 'France', count: 2 },
      { key: 'DE', name: 'Germany', count: 1 },
    ])
  })

  it('drops features with no ISO country code', () => {
    const result = countryZones(countries, [])

    expect(result.features.map((f) => f.properties.name)).not.toContain(
      'Siachen Glacier',
    )
  })

  it('ignores locations whose country was never resolved', () => {
    const result = countryZones(countries, [
      makeLocation({ country_code: null }),
    ])

    expect(result.features.every((f) => f.properties.count === 0)).toBe(true)
  })

  it('keeps the source geometry by reference', () => {
    const result = countryZones(countries, [])

    expect(result.features[0].geometry).toBe(countries.features[0].geometry)
  })
})

describe('subdivisionZones', () => {
  const subdivisions = collection([
    { properties: { name: 'Bavaria', country_code: 'DE', code: 'DE-BY' } },
    { properties: { name: 'Berlin', country_code: 'DE', code: 'DE-BE' } },
    { properties: { name: 'Unnamed area', country_code: 'DE' } },
    { properties: { name: 'Occitanie', country_code: 'FR', code: 'FR-OCC' } },
  ])

  it('keeps only the selected country and counts by subdivision', () => {
    const result = subdivisionZones(
      subdivisions,
      [
        makeLocation({ country_code: 'DE', subdivision_code: 'DE-BY' }),
        makeLocation({ country_code: 'DE', subdivision_code: 'DE-BY' }),
        makeLocation({ country_code: 'FR', subdivision_code: 'FR-OCC' }),
      ],
      'DE',
    )

    expect(result.features.map((f) => f.properties)).toEqual([
      { key: 'DE-BY', name: 'Bavaria', count: 2 },
      { key: 'DE-BE', name: 'Berlin', count: 0 },
      { key: 'DE:Unnamed area', name: 'Unnamed area', count: 0 },
    ])
  })

  it('does not credit a subdivision code from another country', () => {
    const result = subdivisionZones(
      subdivisions,
      [makeLocation({ country_code: 'FR', subdivision_code: 'DE-BY' })],
      'DE',
    )

    expect(result.features.every((f) => f.properties.count === 0)).toBe(true)
  })

  it('leaves locations with no subdivision uncounted', () => {
    const result = subdivisionZones(
      subdivisions,
      [makeLocation({ country_code: 'DE', subdivision_code: null })],
      'DE',
    )

    expect(result.features.every((f) => f.properties.count === 0)).toBe(true)
  })
})

describe('zoneTooltip', () => {
  it('names the zone and its location count', () => {
    expect(zoneTooltip({ key: 'FR', name: 'France', count: 3 })).toBe(
      'France — 3 locations',
    )
  })

  it('uses the singular for exactly one location', () => {
    expect(zoneTooltip({ key: 'FR', name: 'France', count: 1 })).toBe(
      'France — 1 location',
    )
  })

  it('says so when the zone is empty', () => {
    expect(zoneTooltip({ key: 'FR', name: 'France', count: 0 })).toBe(
      'France — no locations here',
    )
  })
})

describe('boundsOf', () => {
  function zoneCollection(geometry: Geometry): ZoneFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry,
          properties: { key: 'X', name: 'X', count: 0 },
        },
      ],
    }
  }

  it('spans every ring of a polygon', () => {
    expect(boundsOf(zoneCollection(square(2, 3)))).toEqual([2, 3, 3, 4])
  })

  it('spans every part of a multipolygon', () => {
    const multi: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ],
        ],
      ],
    }

    expect(boundsOf(zoneCollection(multi))).toEqual([0, 0, 6, 6])
  })

  it('returns null for an empty collection', () => {
    expect(boundsOf({ type: 'FeatureCollection', features: [] })).toBeNull()
  })
})

describe('useZonesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads each level once', async () => {
    const countries = collection([
      { properties: { name: 'France', country_code: 'FR' } },
    ])
    vi.mocked(loadCountryZones).mockResolvedValue(countries)

    const store = useZonesStore()
    await store.load('country')
    await store.load('country')

    expect(loadCountryZones).toHaveBeenCalledTimes(1)
    expect(store.countries).toBe(countries)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('loads the subdivision layer separately', async () => {
    const subdivisions = collection([
      { properties: { name: 'Bavaria', country_code: 'DE', code: 'DE-BY' } },
    ])
    vi.mocked(loadSubdivisionZones).mockResolvedValue(subdivisions)

    const store = useZonesStore()
    await store.load('subdivision')

    expect(loadCountryZones).not.toHaveBeenCalled()
    expect(store.subdivisions).toBe(subdivisions)
  })

  it('surfaces a load failure and allows a retry', async () => {
    vi.mocked(loadCountryZones).mockRejectedValueOnce(new Error('offline'))

    const store = useZonesStore()
    await store.load('country')

    expect(store.error).toBe('Failed to load map geometry.')
    expect(store.countries).toBeNull()
    expect(store.loading).toBe(false)

    const countries = collection([
      { properties: { name: 'France', country_code: 'FR' } },
    ])
    vi.mocked(loadCountryZones).mockResolvedValue(countries)
    await store.load('country')

    expect(store.error).toBeNull()
    expect(store.countries).toBe(countries)
  })
})
