// All HTTP calls live under src/api/ — components and stores import from here.

import { apiFetch, parse } from './client'
import type { Location } from './locations'

// How much of an album's `date` is meaningful, and so how it is displayed.
export type DatePrecision = 'day' | 'month' | 'year'

export interface Album {
  id: string
  name: string
  description: string | null
  // Always a full ISO date (YYYY-MM-DD); with month/year precision the finer
  // parts are just the first of the period.
  date: string
  date_precision: DatePrecision
  immich_album_id: string | null
  location_count: number
  created_at: string
  updated_at: string
}

export interface AlbumDetail extends Album {
  // In the order they were added to the album.
  locations: Location[]
}

export interface AlbumCreate {
  name: string
  description?: string | null
  date: string
  date_precision: DatePrecision
  immich_album_id?: string | null
}

// Only the keys present change; `null` clears description / immich_album_id.
export type AlbumUpdate = Partial<AlbumCreate>

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function listAlbums(): Promise<Album[]> {
  return parse<Album[]>(await apiFetch('/api/albums'))
}

export async function getAlbum(id: string): Promise<AlbumDetail> {
  return parse<AlbumDetail>(await apiFetch(`/api/albums/${id}`))
}

export async function createAlbum(input: AlbumCreate): Promise<AlbumDetail> {
  return parse<AlbumDetail>(
    await apiFetch('/api/albums', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    }),
  )
}

export async function updateAlbum(
  id: string,
  input: AlbumUpdate,
): Promise<AlbumDetail> {
  return parse<AlbumDetail>(
    await apiFetch(`/api/albums/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteAlbum(id: string): Promise<void> {
  const response = await apiFetch(`/api/albums/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
}

export async function addAlbumLocation(
  albumId: string,
  locationId: string,
): Promise<AlbumDetail> {
  return parse<AlbumDetail>(
    await apiFetch(`/api/albums/${albumId}/locations`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ location_id: locationId }),
    }),
  )
}

export async function removeAlbumLocation(
  albumId: string,
  locationId: string,
): Promise<void> {
  const response = await apiFetch(
    `/api/albums/${albumId}/locations/${locationId}`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
}
