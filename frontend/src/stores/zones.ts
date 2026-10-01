import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import {
  loadCountryZones,
  loadSubdivisionZones,
  type ZoneCollection,
} from '../assets/geo'
import type { Location } from '../api/locations'

/** The administrative level a zone polygon is drawn at. */
export type ZoneLevel = 'country' | 'subdivision'

/** What the renderers and the hover panel need to know about one polygon. */
export interface ZoneInfo {
  /**
   * ISO 3166-1 alpha-2 at country level, ISO 3166-2 at subdivision level, or a
   * synthetic name-based key for polygons Natural Earth leaves uncoded.
   */
  key: string
  name: string
  count: number
  level: ZoneLevel
  /** The owning country's alpha-2 code; null for uncoded territories. */
  country: string | null
  /**
   * Whether a click toggles the zone's level: true for every subdivision, and
   * for countries that actually have subdivisions to expand into.
   */
  clickable: boolean
}

export type ZoneFeature = Feature<Geometry, ZoneInfo>
export type ZoneFeatureCollection = FeatureCollection<Geometry, ZoneInfo>

function tally(
  locations: Location[],
  keys: (location: Location) => readonly (string | null)[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const location of locations) {
    for (const value of keys(location)) {
      if (!value) continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return counts
}

/** Groups subdivision polygons by the country they belong to. */
function byCountry(
  collection: ZoneCollection | null,
): Map<string, ZoneCollection['features']> {
  const groups = new Map<string, ZoneCollection['features']>()
  for (const feature of collection?.features ?? []) {
    const country = feature.properties.country_code
    if (!country) continue
    const group = groups.get(country)
    if (group) group.push(feature)
    else groups.set(country, [feature])
  }
  return groups
}

/**
 * The polygons to draw: every country at country level, except those in
 * ``expanded``, which are replaced by their subdivisions. Each polygon is
 * annotated with how many of ``locations`` fall in it.
 *
 * A location counts towards a subdivision when *any* of its ISO 3166-2 codes
 * match: Nominatim reports every administrative level, and which one Natural
 * Earth models varies by country (French departments, but German states).
 *
 * Countries whose subdivisions have not loaded yet, or that have none, stay
 * whole even when expanded — and are not clickable, since a click would do
 * nothing.
 */
export function zoneFeatures(
  countries: ZoneCollection,
  subdivisions: ZoneCollection | null,
  locations: Location[],
  expanded: ReadonlySet<string>,
): ZoneFeatureCollection {
  const countryCounts = tally(locations, (l) => [l.country_code])
  const subdivisionCounts = tally(locations, (l) =>
    // Guards against a code that does not belong to the location's country.
    l.subdivision_codes.filter((code) => code.startsWith(`${l.country_code}-`)),
  )
  const groups = byCountry(subdivisions)

  return {
    type: 'FeatureCollection',
    features: countries.features.flatMap((feature): ZoneFeature[] => {
      const { country_code: country, name } = feature.properties
      const parts = country ? (groups.get(country) ?? []) : []
      // A single polygon would just redraw the country under another name.
      const divisible = parts.length > 1

      if (country && divisible && expanded.has(country)) {
        return parts.map((part) => {
          const code = part.properties.code
          return {
            type: 'Feature',
            geometry: part.geometry,
            properties: {
              key: code ?? `${country}:${part.properties.name}`,
              name: part.properties.name,
              count: code ? (subdivisionCounts.get(code) ?? 0) : 0,
              level: 'subdivision',
              country,
              clickable: true,
            },
          }
        })
      }

      return [
        {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            key: country ?? name,
            name,
            count: country ? (countryCounts.get(country) ?? 0) : 0,
            level: 'country',
            country: country ?? null,
            clickable: divisible,
          },
        },
      ]
    }),
  }
}

/** One line summarising how many locations a zone holds. */
export function zoneCountLabel(zone: ZoneInfo): string {
  if (zone.count === 0) return 'No locations here'
  return `${zone.count} ${zone.count === 1 ? 'location' : 'locations'}`
}

/** Colours shared by both zone renderers, so the projections look identical. */
export interface ZonePalette {
  /** Sea — the map background, and the globe's sphere. */
  water: string
  /** Space around the globe. */
  space: string
  /** Land without any locations. */
  empty: string
  /** Zones holding at least one location. */
  filled: string
  /** Fill of the zone under the pointer. */
  hover: string
  /** Borders between countries — drawn on top so they stay prominent. */
  countryLine: string
  /** Borders between subdivisions of an expanded country. */
  subdivisionLine: string
}

export function zonePalette(dark: boolean): ZonePalette {
  return dark
    ? {
        water: '#0f172a', // slate-900
        space: '#020617', // slate-950
        empty: '#334155', // slate-700
        filled: '#6366f1', // indigo-500
        hover: '#818cf8', // indigo-400
        countryLine: '#94a3b8', // slate-400
        subdivisionLine: '#1e293b', // slate-800
      }
    : {
        water: '#e0f2fe', // sky-100
        space: '#f8fafc', // slate-50
        empty: '#cbd5e1', // slate-300
        filled: '#6366f1', // indigo-500
        hover: '#a5b4fc', // indigo-300
        countryLine: '#475569', // slate-600
        subdivisionLine: '#ffffff',
      }
}

export const useZonesStore = defineStore('zones', () => {
  // shallowRef: these collections hold thousands of features and every nested
  // coordinate array would otherwise be wrapped in a reactive proxy.
  const countries = shallowRef<ZoneCollection | null>(null)
  const subdivisions = shallowRef<ZoneCollection | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)

  /** Fetches a level's geometry once; repeat calls are a no-op. */
  async function load(level: ZoneLevel): Promise<void> {
    if (level === 'country' ? countries.value : subdivisions.value) return
    loading.value = true
    error.value = null
    try {
      if (level === 'country') {
        countries.value = await loadCountryZones()
      } else {
        subdivisions.value = await loadSubdivisionZones()
      }
    } catch {
      error.value = 'Failed to load map geometry.'
    } finally {
      loading.value = false
    }
  }

  return { countries, subdivisions, loading, error, load }
})
