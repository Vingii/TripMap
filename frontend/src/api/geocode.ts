// All HTTP calls live under src/api/ — components and stores import from here.

export interface GeocodeResult {
  name: string
  lat: number
  lng: number
  country_code: string | null
}

/**
 * Forward-geocode a place name into a ranked list of matches via the backend
 * Nominatim proxy. Returns an empty list for a blank query.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (!q) return []

  const response = await fetch(
    `/api/geocode/search?q=${encodeURIComponent(q)}`,
    { signal },
  )
  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`)
  }
  return (await response.json()) as GeocodeResult[]
}
