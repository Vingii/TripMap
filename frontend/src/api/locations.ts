// All HTTP calls live under src/api/ — components and stores import from here.

export interface Location {
  id: string
  name: string
  lat: number
  lng: number
  country_code: string | null
  visited: boolean
  created_at: string
  updated_at: string
}

export interface LocationCreate {
  name: string
  lat: number
  lng: number
  // Omitted for map-click / manual entry — the backend reverse-geocodes it.
  country_code?: string | null
}

export interface LocationUpdate {
  name?: string
  lat?: number
  lng?: number
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export async function listLocations(): Promise<Location[]> {
  return parse<Location[]>(await fetch('/api/locations'))
}

export async function createLocation(input: LocationCreate): Promise<Location> {
  return parse<Location>(
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function updateLocation(
  id: string,
  input: LocationUpdate,
): Promise<Location> {
  return parse<Location>(
    await fetch(`/api/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteLocation(id: string): Promise<void> {
  const response = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
}
