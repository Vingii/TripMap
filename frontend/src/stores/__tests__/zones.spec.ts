import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Geometry } from 'geojson'
import type { ZoneCollection, ZoneProperties } from '../../assets/geo'
import type { Location } from '../../api/locations'
import {
  useZonesStore,
  zoneCountLabel,
  zoneFeatures,
  type ZoneFeatureCollection,
  type ZoneInfo,
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
    subdivision_codes: [],
    visited: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function keyed(
  result: ZoneFeatureCollection,
): Record<string, Omit<ZoneInfo, 'key' | 'name'>> {
  return Object.fromEntries(
    result.features.map(
      ({ properties: { key, count, level, country, clickable } }) => [
        key,
        { count, level, country, clickable },
      ],
    ),
  )
}

describe('zoneFeatures', () => {
  const countries = collection([
    { properties: { name: 'Germany', country_code: 'DE' } },
    { properties: { name: 'France', country_code: 'FR' } },
    { properties: { name: 'Monaco', country_code: 'MC' } },
    { properties: { name: 'Siachen Glacier' } },
  ])
  const subdivisions = collection([
    { properties: { name: 'Bavaria', country_code: 'DE', code: 'DE-BY' } },
    { properties: { name: 'Berlin', country_code: 'DE', code: 'DE-BE' } },
    { properties: { name: 'Nord', country_code: 'FR', code: 'FR-59' } },
    { properties: { name: 'Paris', country_code: 'FR', code: 'FR-75' } },
    { properties: { name: 'Lakes', country_code: 'FR' } },
    { properties: { name: 'Monaco', country_code: 'MC', code: 'MC-MO' } },
  ])
  const none = new Set<string>()

  it('counts locations per country and leaves the rest at zero', () => {
    const result = zoneFeatures(
      countries,
      subdivisions,
      [
        makeLocation({ country_code: 'DE' }),
        makeLocation({ country_code: 'DE' }),
        makeLocation({ country_code: 'FR' }),
        makeLocation({ country_code: null }),
      ],
      none,
    )

    expect(keyed(result)).toEqual({
      DE: { count: 2, level: 'country', country: 'DE', clickable: true },
      FR: { count: 1, level: 'country', country: 'FR', clickable: true },
      MC: { count: 0, level: 'country', country: 'MC', clickable: false },
      'Siachen Glacier': {
        count: 0,
        level: 'country',
        country: null,
        clickable: false,
      },
    })
  })

  it('only marks countries clickable once their subdivisions are known', () => {
    const result = zoneFeatures(countries, null, [], new Set(['DE']))

    expect(result.features.map((f) => f.properties.clickable)).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(result.features[0]?.properties.level).toBe('country')
  })

  it('replaces only expanded countries with their subdivisions', () => {
    const result = zoneFeatures(countries, subdivisions, [], new Set(['FR']))

    expect(result.features.map((f) => f.properties.key)).toEqual([
      'DE',
      'FR-59',
      'FR-75',
      'FR:Lakes',
      'MC',
      'Siachen Glacier',
    ])
    expect(result.features[1]?.properties).toMatchObject({
      name: 'Nord',
      level: 'subdivision',
      country: 'FR',
      clickable: true,
    })
  })

  it('keeps a country with a single subdivision whole', () => {
    const result = zoneFeatures(countries, subdivisions, [], new Set(['MC']))

    expect(keyed(result)['MC']?.level).toBe('country')
  })

  it("credits a subdivision matched by any of a location's codes", () => {
    const result = zoneFeatures(
      countries,
      subdivisions,
      [
        // Nominatim reports the region first; the layer models departments.
        makeLocation({
          country_code: 'FR',
          subdivision_codes: ['FR-HDF', 'FR-59'],
        }),
        makeLocation({
          country_code: 'FR',
          subdivision_codes: ['FR-IDF', 'FR-75'],
        }),
        makeLocation({ country_code: 'FR', subdivision_codes: ['FR-75'] }),
        makeLocation({ country_code: 'DE', subdivision_codes: ['DE-BY'] }),
      ],
      new Set(['DE', 'FR']),
    )

    const counts = Object.fromEntries(
      result.features.map((f) => [f.properties.key, f.properties.count]),
    )
    expect(counts).toEqual({
      'DE-BY': 1,
      'DE-BE': 0,
      'FR-59': 1,
      'FR-75': 2,
      'FR:Lakes': 0,
      MC: 0,
      'Siachen Glacier': 0,
    })
  })

  it('does not credit a subdivision code from another country', () => {
    const result = zoneFeatures(
      countries,
      subdivisions,
      [makeLocation({ country_code: 'FR', subdivision_codes: ['DE-BY'] })],
      new Set(['DE']),
    )

    expect(keyed(result)['DE-BY']?.count).toBe(0)
  })

  it('keeps the source geometry by reference', () => {
    const result = zoneFeatures(countries, subdivisions, [], new Set(['DE']))

    expect(result.features[0]?.geometry).toBe(
      subdivisions.features[0]?.geometry,
    )
    expect(result.features[2]?.geometry).toBe(countries.features[1]?.geometry)
  })
})

describe('zoneCountLabel', () => {
  const zone: ZoneInfo = {
    key: 'DE',
    name: 'Germany',
    count: 0,
    level: 'country',
    country: 'DE',
    clickable: true,
  }

  it("counts the zone's locations", () => {
    expect(zoneCountLabel({ ...zone, count: 3 })).toBe('3 locations')
  })

  it('uses the singular for exactly one location', () => {
    expect(zoneCountLabel({ ...zone, count: 1 })).toBe('1 location')
  })

  it('says so when the zone is empty', () => {
    expect(zoneCountLabel(zone)).toBe('No locations here')
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
