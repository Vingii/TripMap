// All HTTP calls live under src/api/ — components and stores import from here.

import { apiFetch, parse } from './client'

export interface Location {
  id: string
  name: string
  lat: number
  lng: number
  country_code: string | null
  // Scoped to the current user: whether *they* have marked this location visited.
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

export async function listLocations(): Promise<Location[]> {
  return parse<Location[]>(await apiFetch('/api/locations'))
}

export async function createLocation(input: LocationCreate): Promise<Location> {
  return parse<Location>(
    await apiFetch('/api/locations', {
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
    await apiFetch(`/api/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function setLocationVisited(
  id: string,
  visited: boolean,
): Promise<Location> {
  return parse<Location>(
    await apiFetch(`/api/locations/${id}/visited`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visited }),
    }),
  )
}

export async function deleteLocation(id: string): Promise<void> {
  const response = await apiFetch(`/api/locations/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
}
