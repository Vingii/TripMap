import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import {
  loadCountryZones,
  loadSubdivisionZones,
  type ZoneCollection,
} from '../assets/geo'
import type { Location } from '../api/locations'

/** Which administrative level the choropleth is drawing. */
export type ZoneLevel = 'country' | 'subdivision'

/** What the renderers and the tooltip need to know about one polygon. */
export interface ZoneInfo {
  /** ISO 3166-1 alpha-2 at country level, ISO 3166-2 at subdivision level. */
  key: string
  name: string
  count: number
}

export type ZoneFeature = Feature<Geometry, ZoneInfo>
export type ZoneFeatureCollection = FeatureCollection<Geometry, ZoneInfo>

function tally(
  locations: Location[],
  key: (location: Location) => string | null,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const location of locations) {
    const value = key(location)
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function zone(
  feature: ZoneCollection['features'][number],
  key: string,
  count: number,
): ZoneFeature {
  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: { key, name: feature.properties.name, count },
  }
}

/**
 * Country polygons annotated with how many of ``locations`` fall in each.
 * Features Natural Earth leaves without an ISO code are dropped — nothing can
 * ever join to them.
 */
export function countryZones(
  collection: ZoneCollection,
  locations: Location[],
): ZoneFeatureCollection {
  const counts = tally(locations, (l) => l.country_code)
  return {
    type: 'FeatureCollection',
    features: collection.features.flatMap((feature) => {
      const key = feature.properties.country_code
      return key ? [zone(feature, key, counts.get(key) ?? 0)] : []
    }),
  }
}

/**
 * Subdivision polygons of a single country, annotated with location counts.
 * Subdivisions with no ISO 3166-2 code keep a synthetic key so the country is
 * still drawn whole; they simply stay at zero because nothing can match them.
 */
export function subdivisionZones(
  collection: ZoneCollection,
  locations: Location[],
  countryCode: string,
): ZoneFeatureCollection {
  const counts = tally(
    locations.filter((l) => l.country_code === countryCode),
    (l) => l.subdivision_code,
  )
  return {
    type: 'FeatureCollection',
    features: collection.features.flatMap((feature) => {
      const { country_code: country, code, name } = feature.properties
      if (country !== countryCode) return []
      const key = code ?? `${countryCode}:${name}`
      return [zone(feature, key, code ? (counts.get(code) ?? 0) : 0)]
    }),
  }
}

/** Hover label: the zone's name plus how many locations it holds. */
export function zoneTooltip(zone: ZoneInfo): string {
  if (zone.count === 0) return `${zone.name} — no locations here`
  const plural = zone.count === 1 ? 'location' : 'locations'
  return `${zone.name} — ${zone.count} ${plural}`
}

function eachPosition(geometry: Geometry, visit: (p: Position) => void): void {
  // The bundled Natural Earth layers only ever contain (multi)polygons.
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) ring.forEach(visit)
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) ring.forEach(visit)
    }
  }
}

/** Extent of a collection as ``[west, south, east, north]``; null when empty. */
export function boundsOf(
  collection: ZoneFeatureCollection,
): [number, number, number, number] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const feature of collection.features) {
    eachPosition(feature.geometry, ([lng, lat]) => {
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    })
  }

  return west <= east && south <= north ? [west, south, east, north] : null
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
