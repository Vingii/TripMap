// All HTTP calls live under src/api/ — components and stores import from here.

import { apiFetch, parse } from './client'

export type Theme = 'light' | 'dark' | 'system'
export type Projection = 'flat' | 'globe'
export type MapFilter = 'all' | 'visited'

export interface UserSettings {
  theme: Theme
  default_projection: Projection
  default_map_filter: MapFilter
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
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  return parse<UserSettings>(
    await apiFetch('/api/me/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
}
