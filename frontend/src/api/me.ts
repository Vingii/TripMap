// All HTTP calls live under src/api/ — components and stores import from here.

import { apiFetch, parse } from './client'

export type Theme = 'light' | 'dark' | 'system'
export type Projection = 'flat' | 'globe'
export type MapFilter = 'all' | 'visited'

// Settings as returned by the API. The Immich API key is write-only: the server
// never echoes it back, only whether one is currently stored.
export interface UserSettings {
  theme: Theme
  default_projection: Projection
  default_map_filter: MapFilter
  default_visited: boolean
  immich_api_key_set: boolean
}

// Partial settings patch — only supplied keys change. Send `immich_api_key` as
// '' or null to clear a previously stored key.
export interface UserSettingsUpdate {
  theme?: Theme
  default_projection?: Projection
  default_map_filter?: MapFilter
  default_visited?: boolean
  immich_api_key?: string | null
}

export interface User {
  id: string
  email: string
  display_name: string | null
  settings: UserSettings
  created_at: string
  updated_at: string
}

export async function getMe(): Promise<User> {
  return parse<User>(await apiFetch('/api/me'))
}

export async function getMySettings(): Promise<UserSettings> {
  return parse<UserSettings>(await apiFetch('/api/me/settings'))
}

export async function updateMySettings(
  patch: UserSettingsUpdate,
): Promise<UserSettings> {
  return parse<UserSettings>(
    await apiFetch('/api/me/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}
